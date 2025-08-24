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
import { DatabaseAuthStateService } from './auth-state/database-auth-state.service';
import { WhatsAppSyncService } from './sync/whatsapp-sync.service';
import { WhatsAppMessageService } from './message/whatsapp-message.service';
import * as qrcode from 'qrcode-terminal';

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
    private databaseAuthState: DatabaseAuthStateService,
    private whatsappSync: WhatsAppSyncService,
    private whatsappMessageService: WhatsAppMessageService,
  ) {}

  async createConnection(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean; deviceId: string }> {
    // Check if device exists
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    try { 
      // Use hybrid approach: file-based for new devices, database for existing
      let authState;
      
      // Check if we have existing credentials in database
      const hasExistingCreds = await this.databaseAuthState.hasExistingCredentials(deviceId);
      
      if (hasExistingCreds) {
        // Use database auth state for existing devices
        authState = await this.databaseAuthState.createDatabaseAuthState(deviceId, userId, tenantId);
      } else {
        // Use file-based auth state for new devices (more reliable for initial setup)
        authState = await this.getOrCreateAuthState(deviceId);
      }

      // Log auth state status for debugging
      if (authState.state && authState.state.creds && Object.keys(authState.state.creds).length > 0) {
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
      const socketConfig: any = {
        version,
        logger: this.baileysLogger,
        browser: ['WhatsApp API', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        qrTimeout: 60_000, // 60 seconds for QR timeout
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60_000, // Increase query timeout
        retryRequestDelayMs: 250, // Reduce retry delay
        maxMsgRetryCount: 5, // Increase retry count
        getMessage: async (key) => {
          return {
            conversation: 'Hello World!',
          };
        },
        shouldSyncHistoryMessage: (msg) => {
          // Only sync recent messages to reduce load
          // Check if message has timestamp and is recent
          if (msg && typeof msg === 'object' && 'timestamp' in msg) {
            const messageAge = Date.now() - (msg.timestamp as number) * 1000;
            return messageAge < 3 * 24 * 60 * 60 * 1000; // 3 days
          }
          // If no timestamp available, sync by default but limit to reduce load
          return true;
        },
      };

      // Always provide auth state, even if empty (Baileys requires it)
      socketConfig.auth = authState.state;

      const sock = makeWASocket(socketConfig);

      // Handle connection events
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Generate QR code and store it
          await this.updateQRCode(deviceId, qr);
          this.logger.log(`QR code generated for device ${deviceId}`);
          
          // Display QR code in terminal for easy scanning
          console.log('\n🔗 WhatsApp QR Code for device:', deviceId);
          console.log('📱 Scan this QR code with your WhatsApp mobile app:');
          console.log('   Settings → Linked Devices → Link a Device\n');
          
          qrcode.generate(qr, { small: true }, (qrString) => {
            console.log(qrString);
            console.log('\n⏰ QR code will expire in 5 minutes');
            console.log('🔄 If expired, generate a new QR code via API\n');
          });
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
          
          // Migrate to database storage if using file-based auth
          if (!hasExistingCreds && authState.state && authState.state.creds && Object.keys(authState.state.creds).length > 0) {
            try {
              await this.databaseAuthState.migrateFromFileAuth(deviceId, userId, tenantId, authState.state);
              this.logger.log(`Migrated auth state to database for device ${deviceId}`);
            } catch (error) {
              this.logger.warn(`Failed to migrate auth state to database: ${error.message}`);
            }
          }
          
          // Display success message
          console.log('\n✅ WhatsApp Device Connected Successfully!');
          console.log(`📱 Device ID: ${deviceId}`);
          console.log('🚀 You can now send messages via API\n');
          
          // Trigger initial sync of contacts and groups
          this.triggerInitialSync(deviceId, sock);
        } else if (connection === 'connecting') {
          this.logger.log(`Connecting device ${deviceId}...`);
        }
      });

      // Handle credential updates
      sock.ev.on('creds.update', async () => {
        await authState.saveCreds(); // Save credentials
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (messageUpdate) => {
        await this.handleIncomingMessages(deviceId, userId, tenantId, messageUpdate);
      });

      // Handle message updates (delivery receipts, read receipts, etc.)
      sock.ev.on('messages.update', async (messageUpdates) => {
        await this.handleMessageUpdates(deviceId, messageUpdates);
      });

      // Handle message reactions
      sock.ev.on('messages.reaction', async (reactions) => {
        this.logger.debug(`Message reactions received for device ${deviceId}:`, reactions);
      });

      // Handle message deletions
      sock.ev.on('message-receipt.update', async (receipts) => {
        await this.handleMessageReceipts(deviceId, receipts);
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
        // Handle unknown errors - including "Connection Failure" and Buffer errors
        if (errorMessage.includes('Connection Failure') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
          this.logger.warn(`Device ${deviceId} network connection failure. Will retry...`);
          shouldReconnect = true;
          reconnectDelay = 3000;
        } else if (errorMessage.includes('Buffer') || errorMessage.includes('Uint8Array') || errorMessage.includes('ERR_INVALID_ARG_TYPE')) {
          this.logger.error(`Device ${deviceId} buffer/data type error: ${errorMessage}. Clearing corrupted session data...`);
          await this.databaseAuthState.clearCorruptedSession(deviceId);
          shouldReconnect = true;
          reconnectDelay = 5000;
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
      let formattedTo = to;
      if (!to || !to.includes('@')) {
        // Remove any + or spaces from phone number
        const cleanNumber = to.replace(/[\s+]/g, '');
        formattedTo = `${cleanNumber}@s.whatsapp.net`;
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

      this.logger.log(`Sending message to ${formattedTo} from device ${deviceId}`);
      
      // Use Promise.race to implement timeout with better error handling
      const sendPromise = connection.sendMessage(formattedTo, messageData);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Message send timeout after 30 seconds')), 30000);
      });

      const result = await Promise.race([sendPromise, timeoutPromise]);
      
      if (!result) {
        throw new Error('Failed to send message - no response from WhatsApp');
      }
      
      const messageId = result.key?.id;
      this.logger.log(`Message sent successfully. MessageId: ${messageId}`);
      
      // Store the outgoing message in database
      if (messageId) {
        // Get device info for user/tenant context
        const device = await this.deviceModel.findOne({ deviceId }).exec();
        if (device) {
          await this.storeOutgoingMessage(
            deviceId,
            device.userId,
            device.tenantId,
            formattedTo,
            messageData,
            messageId
          );
        }
      }

      // Log message success
      await this.logMessage(deviceId, formattedTo, message, type, 'sent');
      
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
      
      // For timeout errors, provide more specific error message
      if (error.message.includes('timeout') || error.message.includes('Timed Out')) {
        throw new Error('Message sending timed out. The device may be experiencing connectivity issues or WhatsApp servers are slow. Please try again.');
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
      // Clear database session data
      await this.databaseAuthState.clearDeviceSession(deviceId);
      
      // Clear file-based session (legacy support)
      const deviceSessionDir = path.join('./sessions', deviceId);
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

  /**
   * Trigger initial sync of contacts and groups after connection
   */
  private async triggerInitialSync(deviceId: string, connection: any): Promise<void> {
    try {
      // Wait a bit for connection to stabilize
      setTimeout(async () => {
        try {
          this.logger.log(`Starting initial sync for device ${deviceId}`);
          
          // Sync contacts
          const contactResult = await this.whatsappSync.syncContacts(deviceId, connection);
          this.logger.log(`Contact sync result: ${contactResult.synced} synced, ${contactResult.errors} errors`);
          
          // Sync groups
          const groupResult = await this.whatsappSync.syncGroups(deviceId, connection);
          this.logger.log(`Group sync result: ${groupResult.synced} synced, ${groupResult.errors} errors`);
          
        } catch (error) {
          this.logger.error(`Initial sync failed for device ${deviceId}:`, error.message);
        }
      }, 5000); // 5 second delay
      
    } catch (error) {
      this.logger.error(`Error triggering initial sync for device ${deviceId}:`, error.message);
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
      this.logger.log(`File-based auth state loaded for device ${deviceId}`);
      this.logger.debug(`Auth state structure: state=${!!authState.state}, saveCreds=${!!authState.saveCreds}`);
      
      return authState;
    } catch (error) {
      this.logger.error('Error getting file-based auth state:', error);
      throw error;
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

  getConnection(deviceId: string): any {
    return this.connections.get(deviceId);
  }

  /**
   * Handle incoming messages and store them in database
   */
  private async handleIncomingMessages(deviceId: string, userId: string, tenantId: string, messageUpdate: any): Promise<void> {
    try {
      const { messages, type } = messageUpdate;
      
      if (type !== 'notify') {
        return; // Only process new messages
      }

      for (const message of messages) {
        if (!message.key || !message.message) {
          continue;
        }

        // Skip messages from status broadcast
        if (message.key.remoteJid === 'status@broadcast') {
          continue;
        }

        // Determine message direction
        const direction = message.key.fromMe ? 'outgoing' : 'incoming';
        
        // Parse and store the message
        const parsedMessage = this.whatsappMessageService.parseMessage(
          deviceId,
          userId,
          tenantId,
          message,
          direction
        );

        if (parsedMessage) {
          await this.whatsappMessageService.storeMessage(parsedMessage);
          
          this.logger.debug(`Stored ${direction} message ${message.key.id} from ${message.key.remoteJid}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling incoming messages for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Handle message status updates (delivered, read, etc.)
   */
  private async handleMessageUpdates(deviceId: string, messageUpdates: any[]): Promise<void> {
    try {
      for (const update of messageUpdates) {
        if (update.key && update.update) {
          const messageId = update.key.id;
          
          // Determine status from update
          let status = 'sent';
          if (update.update.status) {
            switch (update.update.status) {
              case 1:
                status = 'delivered';
                break;
              case 2:
                status = 'read';
                break;
              case 3:
                status = 'failed';
                break;
              default:
                status = 'sent';
            }
          }

          // Update message status in database
          await this.whatsappMessageService.updateMessageStatus(deviceId, messageId, status);
          
          this.logger.debug(`Updated message ${messageId} status to ${status}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling message updates for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Handle message receipts
   */
  private async handleMessageReceipts(deviceId: string, receipts: any[]): Promise<void> {
    try {
      for (const receipt of receipts) {
        if (receipt.key && receipt.receipt) {
          const messageId = receipt.key.id;
          const receiptType = receipt.receipt.type;
          
          let status = 'sent';
          switch (receiptType) {
            case 'delivery':
              status = 'delivered';
              break;
            case 'read':
              status = 'read';
              break;
          }

          await this.whatsappMessageService.updateMessageStatus(deviceId, messageId, status);
          
          this.logger.debug(`Updated message ${messageId} receipt to ${status}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling message receipts for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Store outgoing message when sent via API
   */
  async storeOutgoingMessage(
    deviceId: string,
    userId: string,
    tenantId: string,
    to: string,
    messageContent: any,
    messageId: string
  ): Promise<void> {
    try {
      // Create a Baileys-like message structure for parsing
      const baileysMessage = {
        key: {
          id: messageId,
          remoteJid: to,
          fromMe: true
        },
        message: messageContent,
        messageTimestamp: Math.floor(Date.now() / 1000)
      };

      const parsedMessage = this.whatsappMessageService.parseMessage(
        deviceId,
        userId,
        tenantId,
        baileysMessage,
        'outgoing'
      );

      if (parsedMessage) {
        await this.whatsappMessageService.storeMessage(parsedMessage);
        this.logger.debug(`Stored outgoing message ${messageId} to ${to}`);
      }
    } catch (error) {
      this.logger.error(`Error storing outgoing message:`, error.message);
    }
  }
}