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

interface RetryInfo {
  count: number;
  lastAttempt: Date;
}

@Injectable()
export class BaileysService {
  private readonly logger = new Logger(BaileysService.name);
  private readonly baileysLogger = new BaileysLogger(this.logger);
  private connections = new Map<string, any>();
  private authStates = new Map<string, any>();
  private retryInfo = new Map<string, RetryInfo>();
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Progressive delays in ms

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
          await this.handleConnectionClose(deviceId, userId, tenantId, lastDisconnect);
        } else if (connection === 'open') {
          this.logger.log(`Connection opened successfully for device ${deviceId}`);
          await this.updateConnectionStatus(deviceId, true);
          // Reset retry counter on successful connection
          this.retryInfo.delete(deviceId);
          // Save auth state after successful connection
          await authState.saveCreds();
        } else if (connection === 'connecting') {
          this.logger.log(`Connecting device ${deviceId}...`);
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

  private async handleConnectionClose(deviceId: string, userId: string, tenantId: string, lastDisconnect?: any): Promise<void> {
    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.message || 'Unknown error';
    
    this.logger.warn(`Connection closed for device ${deviceId}. Status: ${statusCode}, Error: ${errorMessage}`);
    
    // Update device status to disconnected
    await this.updateConnectionStatus(deviceId, false);
    
    // Clean up connection
    this.connections.delete(deviceId);
    
    let shouldReconnect = false;
    let reconnectDelay = 1000; // Default 1 second
    
    switch (statusCode) {
      case DisconnectReason.loggedOut:
        this.logger.error(`Device ${deviceId} was logged out. Manual re-authentication required.`);
        await this.clearDeviceSession(deviceId);
        // Don't reconnect - user needs to scan QR again
        break;
        
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.connectionReplaced:
        this.logger.warn(`Device ${deviceId} connection lost. Attempting reconnect...`);
        shouldReconnect = true;
        reconnectDelay = 2000;
        break;
        
      case DisconnectReason.timedOut:
        this.logger.warn(`Device ${deviceId} connection timed out. Attempting reconnect...`);
        shouldReconnect = true;
        reconnectDelay = 5000;
        break;
        
      case DisconnectReason.badSession:
        this.logger.error(`Device ${deviceId} has bad session. Clearing and reconnecting...`);
        await this.clearDeviceSession(deviceId);
        shouldReconnect = true;
        reconnectDelay = 3000;
        break;
        
      case DisconnectReason.restartRequired:
        this.logger.warn(`Device ${deviceId} requires restart. Reconnecting...`);
        shouldReconnect = true;
        reconnectDelay = 1000;
        break;
        
      case DisconnectReason.multideviceMismatch:
        this.logger.error(`Device ${deviceId} has multi-device mismatch. Clearing session...`);
        await this.clearDeviceSession(deviceId);
        shouldReconnect = true;
        reconnectDelay = 5000;
        break;
        
      default:
        // Handle unknown errors - including "Connection Failure"
        if (errorMessage.includes('Connection Failure') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
          this.logger.warn(`Device ${deviceId} network connection failure. Will retry...`);
          shouldReconnect = true;
          reconnectDelay = 3000;
        } else {
          this.logger.error(`Device ${deviceId} unknown disconnect reason: ${statusCode} - ${errorMessage}`);
          shouldReconnect = true;
          reconnectDelay = 5000;
        }
        break;
    }
    
    if (shouldReconnect) {
      await this.scheduleReconnect(deviceId, userId, tenantId, reconnectDelay);
    }
  }
  
  private async scheduleReconnect(deviceId: string, userId: string, tenantId: string, baseDelay: number): Promise<void> {
    const retryInfo = this.retryInfo.get(deviceId) || { count: 0, lastAttempt: new Date() };
    
    if (retryInfo.count >= this.MAX_RETRY_ATTEMPTS) {
      this.logger.error(`Max retry attempts (${this.MAX_RETRY_ATTEMPTS}) reached for device ${deviceId}. Stopping reconnection attempts.`);
      this.retryInfo.delete(deviceId);
      return;
    }
    
    const delay = Math.min(baseDelay * Math.pow(2, retryInfo.count), 60000); // Max 60 seconds
    retryInfo.count++;
    retryInfo.lastAttempt = new Date();
    this.retryInfo.set(deviceId, retryInfo);
    
    this.logger.log(`Scheduling reconnect for device ${deviceId} in ${delay}ms (attempt ${retryInfo.count}/${this.MAX_RETRY_ATTEMPTS})`);
    
    setTimeout(async () => {
      try {
        await this.reconnectDevice(deviceId, userId, tenantId);
      } catch (error) {
        this.logger.error(`Scheduled reconnect failed for device ${deviceId}:`, error.message);
      }
    }, delay);
  }
  
  private async reconnectDevice(deviceId: string, userId: string, tenantId: string): Promise<void> {
    try {
      this.logger.log(`Attempting to reconnect device ${deviceId}...`);
      await this.createConnection(deviceId, userId, tenantId);
    } catch (error) {
      this.logger.error(`Failed to reconnect device ${deviceId}:`, error.message);
      throw error;
    }
  }

  async sendMessage(deviceId: string, to: string, message: string, type: 'text' | 'media' = 'text'): Promise<{ success: boolean; messageId?: string; timestamp: Date }> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      throw new NotFoundException(`WhatsApp connection not found for device ${deviceId}. Please connect the device first.`);
    }

    try {
      // Validate the 'to' parameter (WhatsApp number format)
      if (!to || !to.includes('@')) {
        // If no @ symbol, assume it's a phone number and format it
        const formattedTo = to.includes('@') ? to : `${to}@s.whatsapp.net`;
        to = formattedTo;
      }

      let messageData: any;
      
      if (type === 'text') {
        if (!message || message.trim() === '') {
          throw new Error('Message content cannot be empty');
        }
        messageData = { text: message.trim() };
      } else if (type === 'media') {
        // Handle media messages
        messageData = { image: { url: message } };
      } else {
        throw new Error(`Unsupported message type: ${type}`);
      }

      this.logger.log(`Sending message to ${to} from device ${deviceId}`);
      const result = await connection.sendMessage(to, messageData);
      
      if (!result) {
        throw new Error('Failed to send message - no response from WhatsApp');
      }
      
      // Log message
      await this.logMessage(deviceId, to, message, type, 'sent');
      
      const messageId = result.key?.id;
      this.logger.log(`Message sent successfully. MessageId: ${messageId}`);
      
      return {
        success: true,
        messageId: messageId,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Error sending message from device ${deviceId} to ${to}:`, error.message);
      
      // Log failed message attempt
      try {
        await this.logMessage(deviceId, to, message, type, 'failed');
      } catch (logError) {
        this.logger.error('Error logging failed message:', logError.message);
      }
      
      // Throw the error to be handled by the calling service
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
      
      // Clear from memory as well
      this.connections.delete(deviceId);
      this.authStates.delete(deviceId);
      this.retryInfo.delete(deviceId);
      
    } catch (error) {
      this.logger.error(`Error clearing session for device ${deviceId}:`, error);
    }
  }
  
  async forceReconnectDevice(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Reset retry counter
      this.retryInfo.delete(deviceId);
      
      // Disconnect existing connection if any
      const existingConnection = this.connections.get(deviceId);
      if (existingConnection) {
        try {
          existingConnection.end();
        } catch (error) {
          this.logger.warn(`Error ending existing connection for ${deviceId}:`, error.message);
        }
      }
      
      // Clear from memory
      this.connections.delete(deviceId);
      this.authStates.delete(deviceId);
      
      // Attempt new connection
      await this.createConnection(deviceId, userId, tenantId);
      
      return {
        success: true,
        message: `Device ${deviceId} reconnection initiated successfully`
      };
    } catch (error) {
      this.logger.error(`Force reconnect failed for device ${deviceId}:`, error.message);
      return {
        success: false,
        message: `Failed to reconnect device: ${error.message}`
      };
    }
  }
  
  getDeviceRetryStatus(deviceId: string): RetryInfo | null {
    return this.retryInfo.get(deviceId) || null;
  }
  
  getAllConnectedDevices(): string[] {
    return Array.from(this.connections.keys());
  }
}