import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import ILogger from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { WhatsAppDevice, WhatsAppDeviceDocument } from '../schema/whatsapp-device.schema';
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
    @InjectModel(WhatsAppDevice.name) private deviceModel: Model<WhatsAppDeviceDocument>,
  ) {}

  async createConnection(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean; deviceId: string }> {
    // Check if device exists
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    try { 
      // Create or load auth state
      const authState = await this.getOrCreateAuthState(deviceId);

      // Log auth state status for debugging
      if (authState.state && authState.state.creds && authState.state.creds.me) {
        this.logger.log(`Device ${deviceId} has existing credentials`);
      } else {
        this.logger.log(`Device ${deviceId} needs QR authentication (new device)`);
      }

      // Validate that we have the basic auth state structure
      if (!authState || typeof authState !== 'object' || !authState.state) {
        const error = new Error(`Invalid auth state object for device ${deviceId}`);
        this.logger.error('Auth state validation failed:', error);
        throw error;
      }

      // Get latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      this.logger.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Create connection with properly structured auth
      const sock = makeWASocket({
        version,
        logger: this.baileysLogger,
        browser: ['WhatsApp API', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        auth: authState.state, // Use the state property which contains creds and keys
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
            await this.reconnect(deviceId, userId, tenantId);
          }
        } else if (connection === 'open') {
          this.logger.log('Connection opened');
          await this.updateConnectionStatus(deviceId, true);
          // Save auth state after successful connection
          await authState.saveCreds();
        }
      });

      // Handle credential updates
      sock.ev.on('creds.update', async () => {
        await authState.saveCreds(); // Use the built-in save function
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
      
      // Validate that authState has required structure
      if (!authState || typeof authState !== 'object') {
        throw new Error(`Failed to create auth state for device ${deviceId}`);
      }

      // Ensure required functions exist
      if (!authState.saveCreds || typeof authState.saveCreds !== 'function') {
        throw new Error(`Auth state missing saveCreds function for device ${deviceId}`);
      }

      // Log the structure for debugging
      this.logger.log(`Auth state loaded for device ${deviceId}`);
      this.logger.debug(`Auth state structure: state=${!!authState.state}, saveCreds=${!!authState.saveCreds}`);
      
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

  private async reconnect(deviceId: string, userId: string, tenantId: string): Promise<void> {
    try {
      const connection = this.connections.get(deviceId);
      if (connection) {
        await this.createConnection(deviceId, userId, tenantId);
      }
    } catch (error) {
      this.logger.error('Error reconnecting:', error);
    }
  }

  async sendMessage(deviceId: string, to: string, message: string, type: 'text' | 'media' = 'text'): Promise<{ success: boolean; messageId?: string; timestamp: Date }> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      throw new NotFoundException('Device not connected');
    }

    try {

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
      
      return {
        success: true,
        messageId: result.key?.id,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw error;
    }
  }

  private async logMessage(deviceId: string, to: string, message: string, type: string, status: string): Promise<void> {
    try {
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (device) {
        // Create message log entry
        // This would typically go to a separate service
        this.logger.log(`Message logged: ${deviceId} -> ${to} (${type}) - ${status}`);
      }
    } catch (error) {
      this.logger.error('Error logging message:', error);
    }
  }

  async disconnect(deviceId: string): Promise<{ success: boolean }> {
    try {
      const connection = this.connections.get(deviceId);
      if (connection) {
        connection.end();
        this.connections.delete(deviceId);
        this.authStates.delete(deviceId);
        await this.updateConnectionStatus(deviceId, false);
      }
      return { success: true };
    } catch (error) {
      this.logger.error('Error disconnecting:', error);
      throw error;
    }
  }

  // Add alias method for consistency with WhatsApp service
  async disconnectConnection(deviceId: string): Promise<{ success: boolean }> {
    return this.disconnect(deviceId);
  }

  async getConnectionStatus(deviceId: string): Promise<{
    deviceId: string;
    isConnected: boolean;
    deviceInfo: WhatsAppDeviceDocument | null;
    hasQR: boolean;
  }> {
    try {
      const connection = this.connections.get(deviceId);
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      
      return {
        deviceId,
        isConnected: !!connection,
        deviceInfo: device,
        hasQR: !!(device?.qrCode && device.qrExpiry && new Date() < device.qrExpiry),
      };
    } catch (error) {
      this.logger.error('Error getting connection status:', error);
      throw error;
    }
  }

  async findDeviceById(deviceId: string): Promise<WhatsAppDeviceDocument | null> {
    return await this.deviceModel.findOne({ deviceId }).exec();
  }

  async findDeviceByUserAndTenant(deviceId: string, userId: string, tenantId: string): Promise<WhatsAppDeviceDocument | null> {
    return await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
  }

  async getAllDevices(userId?: string, tenantId?: string): Promise<WhatsAppDeviceDocument[]> {
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (tenantId) filter.tenantId = tenantId;

    const devices = await this.deviceModel.find(filter).exec();
    if (!devices || devices.length === 0) {
      throw new NotFoundException('Devices not found');
    }
    return devices;
  }

  async clearDeviceSession(deviceId: string): Promise<void> {
    try {
      const deviceSessionDir = path.join('./sessions', deviceId);
      
      // Remove existing session files
      if (fs.existsSync(deviceSessionDir)) {
        const files = fs.readdirSync(deviceSessionDir);
        for (const file of files) {
          const filePath = path.join(deviceSessionDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        this.logger.log(`Cleared session files for device ${deviceId}`);
      }
    } catch (error) {
      this.logger.error(`Error clearing session for device ${deviceId}:`, error);
    }
  }
}