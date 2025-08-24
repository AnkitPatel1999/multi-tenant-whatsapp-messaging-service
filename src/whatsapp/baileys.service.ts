import { Injectable, Logger } from '@nestjs/common';
import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import ILogger from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { WhatsAppDevice } from '../schema/whatsapp-device.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Create a custom logger that implements ILogger interface
class BaileysLogger {
  constructor(private nestLogger: Logger) {}

  level = 'info';
  
  trace = (message: any, ...args: any[]) => this.nestLogger.debug(message, ...args);
  debug = (message: any, ...args: any[]) => this.nestLogger.debug(message, ...args);
  info = (message: any, ...args: any[]) => this.nestLogger.log(message, ...args);
  warn = (message: any, ...args: any[]) => this.nestLogger.warn(message, ...args);
  error = (message: any, ...args: any[]) => this.nestLogger.error(message, ...args);
  fatal = (message: any, ...args: any[]) => this.nestLogger.error(message, ...args);
  
  child = (bindings: any) => new BaileysLogger(this.nestLogger);
}

@Injectable()
export class BaileysService {
  private readonly logger = new Logger(BaileysService.name);
  private readonly baileysLogger = new BaileysLogger(this.logger);
  private connections = new Map<string, any>();
  private authStates = new Map<string, any>();

  constructor(
    @InjectModel(WhatsAppDevice.name) private deviceModel: Model<WhatsAppDevice>,
  ) {}

  async createConnection(deviceId: string, userId: string, tenantId: string): Promise<any> {
    try {
      // Check if device exists
      const device = await this.deviceModel.findOne({ deviceId, userId, tenantId });
      if (!device) {
        throw new Error('Device not found');
      }

      // Create or load auth state
      const authState = await this.getOrCreateAuthState(deviceId);

      // Get latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Create connection
      const sock = makeWASocket({
        version,
        logger: this.baileysLogger,
        browser: ['WhatsApp API', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        auth: {
          creds: authState.creds,
          keys: makeCacheableSignalKeyStore(authState.keys, this.baileysLogger),
        },
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          return {
            conversation: 'Hello World!',
          };
        },
      });

      // Handle connection events
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Generate QR code and store it
          await this.updateQRCode(deviceId, qr);
          this.logger.log(`QR code generated for device ${deviceId}`);
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          this.logger.log(`Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`);
          
          if (shouldReconnect) {
            await this.reconnect(deviceId);
          }
        } else if (connection === 'open') {
          this.logger.log('Connection opened');
          await this.updateConnectionStatus(deviceId, true);
          // Save auth state after successful connection
          await this.saveAuthState(deviceId, authState);
        }
      });

      // Handle credential updates
      sock.ev.on('creds.update', async () => {
        await this.saveAuthState(deviceId, authState);
      });

      // Handle messages
      sock.ev.on('messages.upsert', async (m) => {
        this.logger.log('New message received:', m);
        // Handle incoming messages here
      });

      // Store connection
      this.connections.set(deviceId, sock);
      this.authStates.set(deviceId, authState);

      return { success: true, deviceId };
    } catch (error) {
      this.logger.error('Error creating connection:', error);
      throw error;
    }
  }

  private async getOrCreateAuthState(deviceId: string): Promise<any> {
    try {
      // Ensure sessions directory exists
      const sessionsDir = './sessions';
      const deviceSessionDir = path.join(sessionsDir, deviceId);
      
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }

      if (!fs.existsSync(deviceSessionDir)) {
        fs.mkdirSync(deviceSessionDir, { recursive: true });
      }

      // Use file-based auth state for reliability
      const authState = await useMultiFileAuthState(deviceSessionDir);
      
      this.logger.log(`Auth state loaded for device ${deviceId}`);
      return authState;
    } catch (error) {
      this.logger.error('Error getting auth state:', error);
      throw error;
    }
  }

  private async saveAuthState(deviceId: string, authState: any): Promise<void> {
    try {
      // Auth state is automatically saved to files by useMultiFileAuthState
      // But we can also save a backup to database if needed
      await this.deviceModel.updateOne(
        { deviceId },
        { 
          authState: JSON.stringify({
            timestamp: new Date().toISOString(),
            hasCredentials: !!authState.creds?.me
          })
        }
      );
    } catch (error) {
      this.logger.error('Error saving auth state:', error);
    }
  }

  private async updateQRCode(deviceId: string, qr: string): Promise<void> {
    try {
      await this.deviceModel.updateOne(
        { deviceId },
        { 
          qrCode: qr,
          qrExpiry: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
        }
      );
    } catch (error) {
      this.logger.error('Error updating QR code:', error);
    }
  }

  private async updateConnectionStatus(deviceId: string, isConnected: boolean): Promise<void> {
    try {
      await this.deviceModel.updateOne(
        { deviceId },
        { 
          isConnected,
          lastConnectedAt: isConnected ? new Date() : undefined
        }
      );
    } catch (error) {
      this.logger.error('Error updating connection status:', error);
    }
  }

  private async reconnect(deviceId: string): Promise<void> {
    try {
      const connection = this.connections.get(deviceId);
      if (connection) {
        await this.createConnection(deviceId, '', '');
      }
    } catch (error) {
      this.logger.error('Error reconnecting:', error);
    }
  }

  async sendMessage(deviceId: string, to: string, message: string, type: 'text' | 'media' = 'text'): Promise<any> {
    try {
      const connection = this.connections.get(deviceId);
      if (!connection) {
        throw new Error('Device not connected');
      }

      let messageData: any;
      
      if (type === 'text') {
        messageData = { text: message };
      } else if (type === 'media') {
        // Handle media messages
        messageData = { image: { url: message } };
      }

      const result = await connection.sendMessage(to, messageData);
      
      // Log message
      await this.logMessage(deviceId, to, message, type, 'sent');
      
      return result;
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw error;
    }
  }

  private async logMessage(deviceId: string, to: string, message: string, type: string, status: string): Promise<void> {
    try {
      const device = await this.deviceModel.findOne({ deviceId });
      if (device) {
        // Create message log entry
        // This would typically go to a separate service
        this.logger.log(`Message logged: ${deviceId} -> ${to} (${type}) - ${status}`);
      }
    } catch (error) {
      this.logger.error('Error logging message:', error);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    try {
      const connection = this.connections.get(deviceId);
      if (connection) {
        connection.end();
        this.connections.delete(deviceId);
        this.authStates.delete(deviceId);
        await this.updateConnectionStatus(deviceId, false);
      }
    } catch (error) {
      this.logger.error('Error disconnecting:', error);
    }
  }

  // Add alias method for consistency with WhatsApp service
  async disconnectConnection(deviceId: string): Promise<void> {
    return this.disconnect(deviceId);
  }

  async getConnectionStatus(deviceId: string): Promise<any> {
    try {
      const connection = this.connections.get(deviceId);
      const device = await this.deviceModel.findOne({ deviceId });
      
      return {
        deviceId,
        isConnected: !!connection,
        deviceInfo: device,
        hasQR: !!device?.qrCode && device.qrExpiry && new Date() < device.qrExpiry,
      };
    } catch (error) {
      this.logger.error('Error getting connection status:', error);
      throw error;
    }
  }
}