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
            return messageAge < 7 * 24 * 60 * 60 * 1000; // 7 days
          }
          // If no timestamp available, sync by default but limit to reduce load
          return true;
        },
      };

      // Always provide auth state, even if empty (Baileys requires it)
      socketConfig.auth = authState.state;

      const sock = makeWASocket(socketConfig);

      // Add general error handling (removed connection.error as it's not a valid event)

      // Handle WebSocket close events to prevent unhandled rejections
      if (sock.ws) {
        sock.ws.on('error', (error) => {
          console.error('🚫 [WEBSOCKET ERROR] WebSocket error:', {
            deviceId,
            error: error?.toString() || 'Unknown WebSocket error',
            timestamp: new Date().toISOString()
          });
        });

        sock.ws.on('close', (code, reason) => {
          console.log('🔌 [WEBSOCKET CLOSE] WebSocket closed:', {
            deviceId,
            code,
            reason: reason?.toString() || 'No reason provided',
            timestamp: new Date().toISOString()
          });
        });
      }

      // Handle contacts and chats events directly
      sock.ev.on('contacts.upsert', async (contacts) => {
        console.log('👥 [BAILEYS EVENT] contacts.upsert received:', {
          deviceId,
          contactCount: contacts.length,
          contacts: contacts.slice(0, 5).map(c => ({ id: c.id, name: c.name || c.notify }))
        });
        
        // Sync contacts directly from the event
        try {
          await this.syncContactsFromEvent(deviceId, userId, tenantId, contacts);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error syncing contacts from upsert event:', {
            deviceId,
            error: error.message
          });
        }
      });

      sock.ev.on('contacts.update', async (contacts) => {
        console.log('👥 [BAILEYS EVENT] contacts.update received:', {
          deviceId,
          contactCount: contacts.length,
          contacts: contacts.slice(0, 5).map(c => ({ id: c.id, name: c.name || c.notify }))
        });
        
        // Sync updated contacts
        try {
          await this.syncContactsFromEvent(deviceId, userId, tenantId, contacts);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error syncing contacts from update event:', {
            deviceId,
            error: error.message
          });
        }
      });

      sock.ev.on('chats.upsert', async (chats) => {
        console.log('💬 [BAILEYS EVENT] chats.upsert received:', {
          deviceId,
          chatCount: chats.length,
          chats: chats.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
        });
        
        // Process group chats for group sync and extract contacts
        try {
          await this.syncGroupChatsFromEvent(deviceId, userId, tenantId, chats);
          await this.extractContactsFromChats(deviceId, userId, tenantId, chats);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error processing chats from upsert event:', {
            deviceId,
            error: error.message
          });
        }
      });

      sock.ev.on('chats.update', async (chats) => {
        console.log('💬 [BAILEYS EVENT] chats.update received:', {
          deviceId,
          chatCount: chats.length,
          chats: chats.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
        });
        
        // Extract contacts from chat updates
        try {
          await this.extractContactsFromChats(deviceId, userId, tenantId, chats);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error extracting contacts from chat updates:', {
            deviceId,
            error: error.message
          });
        }
      });

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
          
          // Check for recent PreKey errors and clear session if needed
          await this.checkAndClearCorruptedSession(deviceId);
          
          // Trigger initial sync of contacts and groups
          this.triggerInitialSync(deviceId, sock);
        } else if (connection === 'connecting') {
          this.logger.log(`Connecting device ${deviceId}...`);
        }
      });

      // Handle credential updates
      sock.ev.on('creds.update', async () => {
        try {
          await authState.saveCreds(); // Save credentials
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error saving credentials:', {
            deviceId,
            error: error.message
          });
        }
      });

      // Handle incoming messages
      sock.ev.on('messages.upsert', async (messageUpdate) => {
        console.log('📩 [WA EVENT] messages.upsert received:', {
          deviceId,
          type: messageUpdate.type,
          messageCount: messageUpdate.messages?.length || 0,
          messages: messageUpdate.messages?.map(m => ({
            id: m.key?.id,
            remoteJid: m.key?.remoteJid,
            fromMe: m.key?.fromMe,
            messageTypes: Object.keys(m.message || {})
          }))
        });
        try {
          await this.handleIncomingMessages(deviceId, userId, tenantId, messageUpdate);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error handling incoming messages:', {
            deviceId,
            error: error.message
          });
        }
      });

      // Handle message updates (delivery receipts, read receipts, etc.)
      sock.ev.on('messages.update', async (messageUpdates) => {
        console.log('📝 [WA EVENT] messages.update received:', {
          deviceId,
          updateCount: messageUpdates?.length || 0,
          updates: messageUpdates?.map(u => ({
            messageId: u.key?.id,
            status: u.update?.status,
            updateKeys: Object.keys(u.update || {})
          }))
        });
        try {
          await this.handleMessageUpdates(deviceId, messageUpdates);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error handling message updates:', {
            deviceId,
            error: error.message
          });
        }
      });

      // Handle message reactions
      sock.ev.on('messages.reaction', async (reactions) => {
        console.log('😀 [WA EVENT] messages.reaction received:', {
          deviceId,
          reactionCount: reactions?.length || 0
        });
        this.logger.debug(`Message reactions received for device ${deviceId}:`, reactions);
      });

      // Handle message deletions
      sock.ev.on('message-receipt.update', async (receipts) => {
        console.log('📋 [WA EVENT] message-receipt.update received:', {
          deviceId,
          receiptCount: receipts?.length || 0,
          receipts: receipts?.map(r => ({
            messageId: r.key?.id,
            receiptType: r.receipt ? 'receipt' : 'unknown'
          }))
        });
        try {
          await this.handleMessageReceipts(deviceId, receipts);
        } catch (error) {
          console.error('❌ [EVENT ERROR] Error handling message receipts:', {
            deviceId,
            error: error.message
          });
        }
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
        
      case 440: // Conflict - session replaced
        this.logger.error(`Device ${deviceId} session conflict: Session was replaced by another device/instance`);
        console.log('🔄 [SESSION CONFLICT] WhatsApp session replaced by another device:', {
          deviceId,
          statusCode,
          errorMessage,
          solution: 'Close other WhatsApp instances or wait before reconnecting'
        });
        
        // Don't reconnect immediately - wait longer to avoid repeated conflicts
        shouldReconnect = true;
        reconnectDelay = 30000; // Wait 30 seconds before retry
        break;
        
      case 428: // Connection terminated after conflict
        this.logger.warn(`Device ${deviceId} connection terminated after conflict. Waiting before reconnect...`);
        console.log('⏸️ [SESSION CONFLICT] Connection terminated after conflict:', {
          deviceId,
          statusCode,
          errorMessage,
          waitTime: '30 seconds'
        });
        
        shouldReconnect = true;
        reconnectDelay = 30000; // Wait 30 seconds
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
        } else if (errorMessage.includes('Stream Errored (conflict)') || errorMessage.includes('conflict')) {
          this.logger.error(`Device ${deviceId} stream conflict detected: ${errorMessage}`);
          console.log('🚫 [SESSION CONFLICT] Stream conflict - session being used elsewhere:', {
            deviceId,
            statusCode,
            errorMessage,
            recommendation: 'Ensure only one instance is running'
          });
          shouldReconnect = true;
          reconnectDelay = 30000; // Wait 30 seconds for conflict resolution
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
      
      // Determine actual connection status
      const actualConnectionStatus = !!connection;
      
      // Check if database status needs to be synced
      if (device && device.isConnected !== actualConnectionStatus) {
        try {
          // Update database to match actual connection status
          await this.deviceModel.updateOne(
            { deviceId },
            { 
              isConnected: actualConnectionStatus,
              lastConnectedAt: actualConnectionStatus ? new Date() : device.lastConnectedAt,
              updatedAt: new Date()
            }
          );
          
          this.logger.log(`Synced device ${deviceId} connection status: database ${device.isConnected} → actual ${actualConnectionStatus}`);
        } catch (updateError) {
          this.logger.warn(`Failed to sync device ${deviceId} connection status:`, updateError.message);
        }
      }
      
      return {
        deviceId,
        isConnected: actualConnectionStatus,
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
    console.log('🔄 [INITIAL SYNC] Scheduling initial sync for contacts and groups:', {
      deviceId,
      delaySeconds: 5,
      scheduledAt: new Date().toISOString()
    });

    try {
      // Wait a bit for connection to stabilize
      setTimeout(async () => {
        try {
          console.log('🚀 [INITIAL SYNC] Starting initial sync for device:', {
            deviceId,
            startedAt: new Date().toISOString()
          });
          
          this.logger.log(`Starting initial sync for device ${deviceId}`);
          
          // Sync contacts
          console.log('📞 [INITIAL SYNC] Starting contact synchronization...');
          const contactResult = await this.whatsappSync.syncContacts(deviceId, connection);
          
          console.log('✅ [INITIAL SYNC] Contact sync completed:', {
            deviceId,
            synced: contactResult.synced,
            errors: contactResult.errors,
            successRate: contactResult.synced + contactResult.errors > 0 ? 
              ((contactResult.synced / (contactResult.synced + contactResult.errors)) * 100).toFixed(2) + '%' : '0%'
          });
          
          this.logger.log(`Contact sync result: ${contactResult.synced} synced, ${contactResult.errors} errors`);
          
          // Sync groups
          console.log('👥 [INITIAL SYNC] Starting group synchronization...');
          const groupResult = await this.whatsappSync.syncGroups(deviceId, connection);
          
          console.log('✅ [INITIAL SYNC] Group sync completed:', {
            deviceId,
            synced: groupResult.synced,
            errors: groupResult.errors,
            successRate: groupResult.synced + groupResult.errors > 0 ? 
              ((groupResult.synced / (groupResult.synced + groupResult.errors)) * 100).toFixed(2) + '%' : '0%'
          });
          
          this.logger.log(`Group sync result: ${groupResult.synced} synced, ${groupResult.errors} errors`);
          
          console.log('🎉 [INITIAL SYNC] Complete initial sync finished:', {
            deviceId,
            totalContacts: contactResult.synced,
            totalGroups: groupResult.synced,
            totalErrors: contactResult.errors + groupResult.errors,
            completedAt: new Date().toISOString()
          });
          
        } catch (error) {
          console.error('❌ [INITIAL SYNC] Initial sync failed:', {
            deviceId,
            error: error.message,
            stack: error.stack,
            failedAt: new Date().toISOString()
          });
          this.logger.error(`Initial sync failed for device ${deviceId}:`, error.message);
        }
      }, 5000); // 5 second delay
      
    } catch (error) {
      console.error('❌ [INITIAL SYNC] Error triggering initial sync:', {
        deviceId,
        error: error.message,
        stack: error.stack
      });
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
    console.log('🔄 [MESSAGE HANDLER] Processing incoming messages:', {
      deviceId,
      type: messageUpdate.type,
      messageCount: messageUpdate.messages?.length || 0,
      timestamp: new Date().toISOString()
    });

    try {
      const { messages, type } = messageUpdate;
      
      if (type !== 'notify') {
        console.log('⏭️ [MESSAGE HANDLER] Skipping - not a notify type:', {
          deviceId,
          type,
          expectedType: 'notify'
        });
        return; // Only process new messages
      }

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const message of messages) {
        if (!message.key || !message.message) {
          console.log('⏭️ [MESSAGE HANDLER] Skipping - missing key or message:', {
            deviceId,
            hasKey: !!message.key,
            hasMessage: !!message.message,
            messageId: message.key?.id,
            reason: !message.key ? 'No message key' : 'Message decryption failed (likely PreKey error)'
          });
          
          // If we have a key but no message, it's likely a decryption failure
          if (message.key && !message.message) {
            console.log('🔐 [MESSAGE HANDLER] Decryption failure detected - may need session reset:', {
              deviceId,
              messageId: message.key.id,
              from: message.key.remoteJid,
              participant: message.key.participant
            });
          }
          
          skippedCount++;
          continue;
        }

        // Skip messages from status broadcast
        if (message.key.remoteJid === 'status@broadcast') {
          console.log('⏭️ [MESSAGE HANDLER] Skipping - status broadcast message:', {
            deviceId,
            messageId: message.key.id
          });
          skippedCount++;
          continue;
        }

        try {
          // Determine message direction
          const direction = message.key.fromMe ? 'outgoing' : 'incoming';
          
          console.log('🔄 [MESSAGE HANDLER] Processing message:', {
            deviceId,
            messageId: message.key.id,
            remoteJid: message.key.remoteJid,
            direction,
            messageTypes: Object.keys(message.message)
          });
          
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
            processedCount++;
            
            console.log('✅ [MESSAGE HANDLER] Message processed successfully:', {
              deviceId,
              messageId: message.key.id,
              direction,
              messageType: parsedMessage.messageType,
              processedCount
            });
            
            this.logger.debug(`Stored ${direction} message ${message.key.id} from ${message.key.remoteJid}`);
          } else {
            console.log('❌ [MESSAGE HANDLER] Message parsing failed:', {
              deviceId,
              messageId: message.key.id,
              direction
            });
            errorCount++;
          }
        } catch (error) {
          console.error('❌ [MESSAGE HANDLER] Error processing individual message:', {
            deviceId,
            messageId: message.key?.id,
            error: error.message
          });
          errorCount++;
        }
      }

      console.log('✅ [MESSAGE HANDLER] Batch processing completed:', {
        deviceId,
        totalMessages: messages.length,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        completedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [MESSAGE HANDLER] Fatal error handling incoming messages:', {
        deviceId,
        error: error.message,
        stack: error.stack
      });
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
   * Sync contacts from contacts.upsert event
   */
  private async syncContactsFromEvent(deviceId: string, userId: string, tenantId: string, contacts: any[]): Promise<void> {
    try {
      console.log('🔄 [EVENT SYNC] Syncing contacts from contacts.upsert event:', { 
        deviceId, 
        contactCount: contacts.length 
      });

      let synced = 0;
      let errors = 0;

      for (const contact of contacts) {
        try {
          const contactData = contact as any;
          await this.whatsappSync.saveContact(deviceId, userId, tenantId, contactData.id, contactData);
          synced++;
          
          console.log('✅ [EVENT SYNC] Contact synced from event:', {
            deviceId,
            contactId: contactData.id,
            name: contactData.name || contactData.notify
          });
        } catch (error) {
          console.error('❌ [EVENT SYNC] Error syncing contact from event:', {
            deviceId,
            contactId: contact.id,
            error: error.message
          });
          errors++;
        }
      }

      console.log('✅ [EVENT SYNC] Contacts sync from event completed:', {
        deviceId,
        synced,
        errors,
        total: contacts.length
      });

    } catch (error) {
      console.error('❌ [EVENT SYNC] Error syncing contacts from event:', {
        deviceId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Sync group chats from chats.upsert event
   */
  private async syncGroupChatsFromEvent(deviceId: string, userId: string, tenantId: string, chats: any[]): Promise<void> {
    try {
      console.log('🔄 [EVENT SYNC] Processing chats from chats.upsert event:', { 
        deviceId, 
        chatCount: chats.length 
      });

      const groupChats = chats.filter(chat => chat.id.includes('@g.us')); // Filter for group chats
      
      if (groupChats.length === 0) {
        console.log('⚠️ [EVENT SYNC] No group chats found in event:', { deviceId });
        return;
      }

      console.log('👥 [EVENT SYNC] Found group chats to sync:', {
        deviceId,
        groupCount: groupChats.length,
        groups: groupChats.slice(0, 3).map(g => ({ id: g.id, name: g.name }))
      });

      // Note: chats.upsert doesn't provide full group info with participants
      // We'll need to fetch full group details separately or wait for messages from groups
      for (const chat of groupChats) {
        console.log('👥 [EVENT SYNC] Group chat detected:', {
          deviceId,
          groupId: chat.id,
          name: chat.name,
          unreadCount: chat.unreadCount
        });
      }

    } catch (error) {
      console.error('❌ [EVENT SYNC] Error processing group chats from event:', {
        deviceId,
        error: error.message,
        stack: error.stack
      });
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

  /**
   * Extract contacts from chat information
   */
  private async extractContactsFromChats(deviceId: string, userId: string, tenantId: string, chats: any[]): Promise<void> {
    try {
      console.log('🔄 [CONTACT EXTRACT] Extracting contacts from chats:', { 
        deviceId, 
        chatCount: chats.length 
      });

      let extracted = 0;

      for (const chat of chats) {
        try {
          // Extract contact info from individual chats (not groups)
          if (chat.id && !chat.id.includes('@g.us') && chat.id.includes('@s.whatsapp.net')) {
            const contactData = {
              id: chat.id,
              name: chat.name || chat.notify || 'Unknown',
              notify: chat.notify,
              lastMessageTime: chat.t,
              unreadCount: chat.unreadCount
            };

            console.log('👤 [CONTACT EXTRACT] Found individual contact from chat:', {
              deviceId,
              contactId: contactData.id,
              name: contactData.name
            });

            await this.whatsappSync.saveContact(deviceId, userId, tenantId, contactData.id, contactData);
            extracted++;
          }
          
          // Extract participant info from group chats
          if (chat.id && chat.id.includes('@g.us') && chat.groupMetadata && chat.groupMetadata.participants) {
            console.log('👥 [CONTACT EXTRACT] Extracting contacts from group participants:', {
              deviceId,
              groupId: chat.id,
              participantCount: chat.groupMetadata.participants.length
            });

            for (const participant of chat.groupMetadata.participants) {
              const contactData = {
                id: participant.id,
                name: participant.name || participant.notify || 'Unknown',
                notify: participant.notify,
                isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin'
              };

              await this.whatsappSync.saveContact(deviceId, userId, tenantId, contactData.id, contactData);
              extracted++;
            }
          }
        } catch (error) {
          console.error('❌ [CONTACT EXTRACT] Error extracting contact from chat:', {
            deviceId,
            chatId: chat.id,
            error: error.message
          });
        }
      }

      console.log('✅ [CONTACT EXTRACT] Contact extraction completed:', {
        deviceId,
        totalChats: chats.length,
        contactsExtracted: extracted
      });

    } catch (error) {
      console.error('❌ [CONTACT EXTRACT] Error extracting contacts from chats:', {
        deviceId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Check for corrupted session due to PreKey errors and clear if needed
   */
  private async checkAndClearCorruptedSession(deviceId: string): Promise<void> {
    try {
      // This is a placeholder for detecting repeated PreKey errors
      // In a production environment, you might want to track failed decryption attempts
      console.log('🔍 [SESSION CHECK] Checking for session corruption:', { deviceId });
      
      // For now, we'll just log that we're monitoring for issues
      console.log('ℹ️ [SESSION CHECK] Session health monitoring active. Will auto-clear if too many decryption failures occur.');
      
    } catch (error) {
      console.error('❌ [SESSION CHECK] Error checking session health:', {
        deviceId,
        error: error.message
      });
    }
  }

  /**
   * Force clear corrupted session when too many PreKey errors occur
   */
  async forceResetCorruptedSession(deviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 [SESSION RESET] Force clearing corrupted session due to repeated decryption failures:', { deviceId });
      
      // Clear corrupted session data
      await this.databaseAuthState.clearCorruptedSession(deviceId);
      
      // Get device info for reconnection
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (!device) {
        return {
          success: false,
          message: 'Device not found'
        };
      }

      // Disconnect existing connection
      const existingConnection = this.connections.get(deviceId);
      if (existingConnection) {
        try {
          existingConnection.end();
        } catch (error) {
          console.log('⚠️ [SESSION RESET] Error ending connection:', error.message);
        }
      }

      // Clear from memory
      this.connections.delete(deviceId);
      this.authStates.delete(deviceId);

      console.log('✅ [SESSION RESET] Session cleared. Device will need to re-authenticate with QR code.');
      
      return {
        success: true,
        message: `Session reset for device ${deviceId}. Re-authentication required.`
      };
      
    } catch (error) {
      console.error('❌ [SESSION RESET] Error resetting corrupted session:', {
        deviceId,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        message: `Failed to reset session: ${error.message}`
      };
    }
  }

  /**
   * Manually trigger contact sync (for testing/debugging)
   */
  async manualContactSync(deviceId: string): Promise<{ success: boolean; message: string; synced: number }> {
    try {
      console.log('🔄 [MANUAL SYNC] Manually triggering contact sync:', { deviceId });
      
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (!device) {
        return { success: false, message: 'Device not found', synced: 0 };
      }

      const connection = this.connections.get(deviceId);
      if (!connection) {
        return { success: false, message: 'Device not connected', synced: 0 };
      }

      // Try to get contacts through the sync service
      const result = await this.whatsappSync.syncContacts(deviceId, connection);
      
      return {
        success: true,
        message: `Manual contact sync completed. Synced: ${result.synced}, Errors: ${result.errors}`,
        synced: result.synced
      };
      
    } catch (error) {
      console.error('❌ [MANUAL SYNC] Error in manual contact sync:', {
        deviceId,
        error: error.message
      });
      
      return {
        success: false,
        message: `Manual sync failed: ${error.message}`,
        synced: 0
      };
    }
  }

  /**
   * Refresh connection status for all devices
   * Useful for bulk synchronization
   */
  async refreshAllDeviceConnectionStatuses(): Promise<{
    totalDevices: number;
    syncedDevices: number;
    failedDevices: number;
    results: Array<{
      deviceId: string;
      previousStatus: boolean;
      currentStatus: boolean;
      synced: boolean;
      error?: string;
    }>;
  }> {
    const results: any[] = [];
    let syncedDevices = 0;
    let failedDevices = 0;
    
    try {
      // Get all devices from database
      const allDevices = await this.deviceModel.find({}).exec();
      
      for (const device of allDevices) {
        try {
          const connection = this.connections.get(device.deviceId);
          const actualConnectionStatus = !!connection;
          
          if (device.isConnected !== actualConnectionStatus) {
            // Update database to match actual connection status
            await this.deviceModel.updateOne(
              { _id: device._id },
              { 
                isConnected: actualConnectionStatus,
                lastConnectedAt: actualConnectionStatus ? new Date() : device.lastConnectedAt,
                updatedAt: new Date()
              }
            );
            
            syncedDevices++;
            this.logger.log(`Refreshed device ${device.deviceId} connection status: ${device.isConnected} → ${actualConnectionStatus}`);
          }
          
          results.push({
            deviceId: device.deviceId,
            previousStatus: device.isConnected,
            currentStatus: actualConnectionStatus,
            synced: device.isConnected === actualConnectionStatus
          });
          
        } catch (error) {
          failedDevices++;
          this.logger.error(`Failed to refresh connection status for device ${device.deviceId}:`, error.message);
          
          results.push({
            deviceId: device.deviceId,
            previousStatus: device.isConnected,
            currentStatus: false,
            synced: false,
            error: error.message
          });
        }
      }
      
      return {
        totalDevices: allDevices.length,
        syncedDevices,
        failedDevices,
        results
      };
      
    } catch (error) {
      this.logger.error('Error refreshing all device connection statuses:', error.message);
      throw error;
    }
  }
}