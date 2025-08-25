import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppDevice, WhatsAppDeviceDocument } from '../schema/whatsapp-device.schema';
import { BaileysService } from './baileys.service';
import { WhatsAppSyncService } from './sync/whatsapp-sync.service';
import { MessageQueueService } from '../queue/services/message-queue.service';
import { CacheService } from '../cache/cache.service';
import { v4 as uuidv4 } from 'uuid';
import { 
  CreateDeviceData, 
  SendMessageData, 
  WhatsAppConnectionResult,
  WhatsAppMessageResult,
  WhatsAppQRResult 
} from '../dto/whatsapp.dto';
import * as QRCode from 'qrcode';
import { WhatsAppMessageService } from './message/whatsapp-message.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectModel(WhatsAppDevice.name) private deviceModel: Model<WhatsAppDeviceDocument>,
    private baileysService: BaileysService,
    private whatsappSync: WhatsAppSyncService,
    private messageQueueService: MessageQueueService,
    private cacheService: CacheService,
    private whatsappMessageService: WhatsAppMessageService,
  ) {}

  async createDevice(createDeviceData: CreateDeviceData): Promise<WhatsAppDeviceDocument> {
    const deviceId = uuidv4();
    
    const device = new this.deviceModel({
      deviceId,
      ...createDeviceData,
      isActive: true,
    });

    await device.save();
    
    // Create Baileys connection - handle errors gracefully
    try {
      await this.baileysService.createConnection(deviceId, createDeviceData.userId, createDeviceData.tenantId);
    } catch (error) {
      this.logger.error(`Failed to create WhatsApp connection for device ${deviceId}:`, error.message);
      // Device is still created successfully, connection can be retried later
      // Don't throw the error to prevent app crash
    }
    
    return device;
  }

  async getDevices(userId: string, tenantId: string): Promise<any[]> {
    const devices = await this.deviceModel.find({ userId, tenantId, isActive: true }).exec();
    
    if (!devices || devices.length === 0) {
      throw new NotFoundException('Devices not found');
    }
    
    // Get connection status for each device and sync with database
    const devicesWithStatus = await Promise.all(
      devices.map(async (device) => {
        try {
          const status = await this.baileysService.getConnectionStatus(device.deviceId);
          
          // Check if device connection status needs to be updated in database
          if (device.isConnected !== status.isConnected) {
            try {
              // Update device connection status in database
              await this.deviceModel.updateOne(
                { _id: device._id },
                { 
                  isConnected: status.isConnected,
                  lastConnectedAt: status.isConnected ? new Date() : device.lastConnectedAt
                }
              );
              
              // Update the device object for this response
              device.isConnected = status.isConnected;
              if (status.isConnected) {
                device.lastConnectedAt = new Date();
              }
              
              this.logger.log(`Updated device ${device.deviceId} connection status: ${status.isConnected}`);
            } catch (updateError) {
              this.logger.warn(`Failed to update device ${device.deviceId} connection status:`, updateError.message);
            }
          }
          
          return { ...device.toObject(), connectionStatus: status };
        } catch (error) {
          this.logger.warn(`Error getting connection status for device ${device.deviceId}:`, error.message);
          // Return device with safe default connection status
          return { 
            ...device.toObject(), 
            connectionStatus: {
              deviceId: device.deviceId,
              isConnected: false,
              deviceInfo: null,
              hasQR: false
            }
          };
        }
      })
    );
    
    return devicesWithStatus;
  }

  async generateQRCode(deviceId: string, userId: string, tenantId: string): Promise<WhatsAppQRResult> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    try {
      // Create or reconnect to get fresh QR code
      await this.baileysService.createConnection(deviceId, userId, tenantId);
      
      // Wait a bit for QR generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = await this.baileysService.getConnectionStatus(deviceId);
      
      // Generate QR code image if we have QR text
      let qrCodeImage: string | undefined;
      let qrCodeBase64: string | undefined;
      
      if (status.deviceInfo?.qrCode) {
        try {
          // Generate QR code as base64 data URL (PNG format)
          qrCodeImage = await QRCode.toDataURL(status.deviceInfo.qrCode, {
            errorCorrectionLevel: 'M',
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          // Also provide just the base64 string without data URL prefix for flexibility
          qrCodeBase64 = await QRCode.toBuffer(status.deviceInfo.qrCode, {
            errorCorrectionLevel: 'M',
            type: 'png',
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          }).then(buffer => buffer.toString('base64'));
          
        } catch (qrError) {
          this.logger.warn(`Failed to generate QR code image for device ${deviceId}:`, qrError.message);
          // Continue without image, fallback to text
        }
      }
      
      return {
        deviceId,
        qrCode: status.deviceInfo?.qrCode, // Keep original text for backward compatibility
        qrCodeImage, // PNG image as data URL (data:image/png;base64,...)
        qrCodeBase64, // Just the base64 string without data URL prefix
        qrExpiry: status.deviceInfo?.qrExpiry,
        isConnected: status.isConnected,
      };
    } catch (error) {
      this.logger.error(`Error generating QR code for device ${deviceId}:`, error.message);
      // Return safe defaults instead of crashing
      return {
        deviceId,
        qrCode: undefined,
        qrCodeImage: undefined,
        qrCodeBase64: undefined,
        qrExpiry: undefined,
        isConnected: false,
      };
    }
  }



  async sendMessage(sendMessageData: SendMessageData): Promise<WhatsAppMessageResult> {
    // Use cached device lookup first
    const deviceCacheKey = `device:${sendMessageData.deviceId}:${sendMessageData.userId}:${sendMessageData.tenantId}`;
    let device = await this.cacheService.get(deviceCacheKey);
    
    if (!device) {
      device = await this.deviceModel.findOne({ 
        deviceId: sendMessageData.deviceId, 
        userId: sendMessageData.userId, 
        tenantId: sendMessageData.tenantId 
      }).exec();
      
      if (device) {
        await this.cacheService.set(deviceCacheKey, device, 300); // Cache for 5 minutes
      }
    }
    
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check cached connection status first
    const cachedStatus = await this.cacheService.get<{ isConnected: boolean }>(`device_status:${sendMessageData.deviceId}`);
    if (cachedStatus && !cachedStatus.isConnected) {
      throw new NotFoundException('Device not connected to WhatsApp. Please connect the device first.');
    }

    // Check actual connection status if not cached
    if (!cachedStatus) {
      try {
        const connectionStatus = await this.baileysService.getConnectionStatus(sendMessageData.deviceId);
        await this.cacheService.set(`device_status:${sendMessageData.deviceId}`, connectionStatus, 300); // 5 minutes TTL
        
        if (!connectionStatus.isConnected) {
          throw new NotFoundException('Device not connected to WhatsApp. Please connect the device first.');
        }
      } catch (error) {
        this.logger.error(`Error checking connection status for device ${sendMessageData.deviceId}:`, error.message);
        throw new NotFoundException('Device not connected to WhatsApp. Please connect the device first.');
      }
    }

    // Retry mechanism for message sending
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Sending message attempt ${attempt}/${maxRetries} for device ${sendMessageData.deviceId}`);
        
        const result = await this.baileysService.sendMessage(
          sendMessageData.deviceId, 
          sendMessageData.to, 
          sendMessageData.message, 
          sendMessageData.type || 'text'
        );
        
        // Store the sent message in the database
        try {
          await this.whatsappMessageService.storeMessage({
            messageId: result?.messageId || `MSG_${Date.now()}`,
            deviceId: sendMessageData.deviceId,
            chatId: sendMessageData.to,
            textContent: sendMessageData.message,
            messageType: sendMessageData.type || 'text',
            direction: 'outgoing',
            userId: sendMessageData.userId,
            tenantId: sendMessageData.tenantId,
            timestamp: result?.timestamp || new Date(),
            status: 'sent',
            isActive: true
          });
        } catch (storeError) {
          this.logger.warn(`Failed to store sent message: ${storeError.message}`);
          // Don't fail the send operation if storage fails
        }
        
        // Success - return result
        return {
          success: result?.success || false,
          messageId: result?.messageId || undefined,
          timestamp: result?.timestamp || new Date()
        };
        
      } catch (error) {
        lastError = error;
        this.logger.warn(`Message send attempt ${attempt} failed for device ${sendMessageData.deviceId}: ${error.message}`);
        
        // Don't retry for certain errors
        if (error.message.includes('not found') || 
            error.message.includes('not connected') ||
            error.message.includes('empty') ||
            error.message.includes('Unsupported message type')) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
          this.logger.log(`Waiting ${delay}ms before retry attempt ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    this.logger.error(`All ${maxRetries} attempts failed for device ${sendMessageData.deviceId}. Last error: ${lastError.message}`);
    throw lastError;
  }

  /**
   * Queue message for async processing (recommended for high throughput)
   */
  async queueMessage(sendMessageData: SendMessageData & { priority?: 'low' | 'normal' | 'high' | 'critical' }): Promise<{ jobId: string; queued: boolean }> {
    try {
      // Validate device exists and is connected (cached lookup)
      const deviceCacheKey = `device:${sendMessageData.deviceId}:${sendMessageData.userId}:${sendMessageData.tenantId}`;
      let device = await this.cacheService.get(deviceCacheKey);
      
      if (!device) {
        device = await this.deviceModel.findOne({ 
          deviceId: sendMessageData.deviceId, 
          userId: sendMessageData.userId, 
          tenantId: sendMessageData.tenantId 
        }).exec();
        
        if (device) {
          await this.cacheService.set(deviceCacheKey, device, 300);
        }
      }
      
      if (!device) {
        throw new NotFoundException('Device not found');
      }

      // Queue the message for async processing
      const jobId = await this.messageQueueService.queueMessage({
        deviceId: sendMessageData.deviceId,
        userId: sendMessageData.userId,
        tenantId: sendMessageData.tenantId,
        to: sendMessageData.to,
        message: sendMessageData.message,
        type: sendMessageData.type || 'text',
        priority: sendMessageData.priority || 'normal',
        scheduledAt: sendMessageData.scheduledAt,
        metadata: sendMessageData.metadata,
      });

      this.logger.log(`Message queued for async processing`, {
        jobId,
        deviceId: sendMessageData.deviceId,
        to: sendMessageData.to,
        priority: sendMessageData.priority,
      });

      return { jobId, queued: true };
    } catch (error) {
      this.logger.error(`Failed to queue message:`, error.message);
      throw error;
    }
  }

  /**
   * Queue multiple messages for bulk processing
   */
  async queueBulkMessages(messages: (SendMessageData & { priority?: 'low' | 'normal' | 'high' | 'critical' })[]): Promise<{ jobIds: string[]; queued: number }> {
    try {
      const jobIds = await this.messageQueueService.queueBulkMessages(messages.map(msg => ({
        deviceId: msg.deviceId,
        userId: msg.userId,
        tenantId: msg.tenantId,
        to: msg.to,
        message: msg.message,
        type: msg.type || 'text',
        priority: msg.priority || 'normal',
        scheduledAt: msg.scheduledAt,
        metadata: msg.metadata,
      })));

      this.logger.log(`Bulk messages queued`, {
        count: messages.length,
        jobIds: jobIds.slice(0, 5), // Log first 5 IDs
      });

      return { jobIds, queued: messages.length };
    } catch (error) {
      this.logger.error(`Failed to queue bulk messages:`, error.message);
      throw error;
    }
  }

  /**
   * Get message job status
   */
  async getMessageJobStatus(jobId: string): Promise<any> {
    return this.messageQueueService.getJobStatus(jobId);
  }

  /**
   * Cancel a queued message
   */
  async cancelQueuedMessage(jobId: string): Promise<boolean> {
    return this.messageQueueService.cancelJob(jobId);
  }

  async disconnectDevice(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean }> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Disconnect from Baileys
    await this.baileysService.disconnectConnection(deviceId);
    
    // Update device status
    device.isConnected = false;
    device.lastConnectedAt = new Date();
    await device.save();
    
    return { success: true };
  }

  async findById(deviceId: string): Promise<WhatsAppDeviceDocument | null> {
    return await this.deviceModel.findOne({ deviceId }).exec();
  }

  async deleteDevice(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean }> {
    const result = await this.deviceModel.deleteOne({ deviceId, userId, tenantId });
    
    if (result.deletedCount === 0) {
      throw new NotFoundException('Device not found');
    }

    // Also disconnect if connected
    try {
      await this.baileysService.disconnectConnection(deviceId);
    } catch (error) {
      // Device might not be connected, ignore error
      this.logger.warn(`Could not disconnect device ${deviceId}: ${error.message}`);
    }

    return { success: true };
  }

  async clearDeviceSession(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean }> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Clear the session files
    await this.baileysService.clearDeviceSession(deviceId);
    
    // Also disconnect if connected
    try {
      await this.baileysService.disconnectConnection(deviceId);
    } catch (error) {
      this.logger.warn(`Could not disconnect device ${deviceId} during session clear: ${error.message}`);
    }

    return { success: true };
  }
  
  async forceReconnectDevice(deviceId: string, userId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return await this.baileysService.forceReconnectDevice(deviceId, userId, tenantId);
  }
  
  async getDeviceConnectionStatus(deviceId: string, userId: string, tenantId: string): Promise<any> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    try {
      const connectionStatus = await this.baileysService.getConnectionStatus(deviceId);
      const retryStatus = this.baileysService.getDeviceRetryStatus(deviceId);
      
      // Sync connection status with database if different
      if (device.isConnected !== connectionStatus.isConnected) {
        try {
          await this.deviceModel.updateOne(
            { _id: device._id },
            { 
              isConnected: connectionStatus.isConnected,
              lastConnectedAt: connectionStatus.isConnected ? new Date() : device.lastConnectedAt
            }
          );
          
          this.logger.log(`Synced device ${deviceId} connection status: ${connectionStatus.isConnected}`);
        } catch (updateError) {
          this.logger.warn(`Failed to sync device ${deviceId} connection status:`, updateError.message);
        }
      }
      
      return {
        deviceId,
        deviceName: device.deviceName,
        isConnected: connectionStatus.isConnected,
        hasQR: connectionStatus.hasQR,
        lastConnectedAt: device.lastConnectedAt,
        retryInfo: retryStatus,
        connectionDetails: connectionStatus
      };
    } catch (error) {
      this.logger.error(`Error getting connection status for device ${deviceId}:`, error.message);
      return {
        deviceId,
        deviceName: device.deviceName,
        isConnected: false,
        hasQR: false,
        lastConnectedAt: device.lastConnectedAt,
        retryInfo: this.baileysService.getDeviceRetryStatus(deviceId),
        error: error.message
      };
    }
  }

  /**
   * Manually sync connection status for a device
   * Useful for debugging connection status mismatches
   */
  async syncDeviceConnectionStatus(deviceId: string, userId: string, tenantId: string): Promise<any> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    try {
      const connectionStatus = await this.baileysService.getConnectionStatus(deviceId);
      
      // Always update the database with current connection status
      const updateResult = await this.deviceModel.updateOne(
        { _id: device._id },
        { 
          isConnected: connectionStatus.isConnected,
          lastConnectedAt: connectionStatus.isConnected ? new Date() : device.lastConnectedAt,
          updatedAt: new Date()
        }
      );
      
      this.logger.log(`Manually synced device ${deviceId} connection status: ${connectionStatus.isConnected}`);
      
      return {
        deviceId,
        previousStatus: device.isConnected,
        currentStatus: connectionStatus.isConnected,
        synced: updateResult.modifiedCount > 0,
        connectionDetails: connectionStatus,
        message: `Device connection status synced from ${device.isConnected} to ${connectionStatus.isConnected}`
      };
    } catch (error) {
      this.logger.error(`Error syncing connection status for device ${deviceId}:`, error.message);
      throw error;
    }
  }
  
  async getConnectionInfo(userId: string, tenantId: string): Promise<any> {
    const devices = await this.deviceModel.find({ userId, tenantId, isActive: true }).exec();
    const connectedDevices = this.baileysService.getAllConnectedDevices();
    
    const deviceStatuses = await Promise.all(
      devices.map(async (device) => {
        try {
          const status = await this.getDeviceConnectionStatus(device.deviceId, userId, tenantId);
          return status;
        } catch (error) {
          return {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            isConnected: false,
            error: error.message
          };
        }
      })
    );
    
    return {
      totalDevices: devices.length,
      connectedDevices: connectedDevices.length,
      deviceStatuses,
      timestamp: new Date()
    };
  }

  async getDeviceContacts(deviceId: string, userId: string, tenantId: string, search?: string): Promise<any> {
    // Verify device ownership
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (search) {
      return await this.whatsappSync.searchContacts(deviceId, userId, tenantId, search);
    } else {
      return await this.whatsappSync.getContacts(deviceId, userId, tenantId);
    }
  }

  async getDeviceGroups(deviceId: string, userId: string, tenantId: string, search?: string): Promise<any> {
    // Verify device ownership
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (search) {
      return await this.whatsappSync.searchGroups(deviceId, userId, tenantId, search);
    } else {
      return await this.whatsappSync.getGroups(deviceId, userId, tenantId);
    }
  }

  async syncDeviceContacts(deviceId: string, userId: string, tenantId: string): Promise<any> {
    // Verify device ownership
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if device is connected
    const connectionStatus = await this.baileysService.getConnectionStatus(deviceId);
    if (!connectionStatus.isConnected) {
      throw new NotFoundException('Device not connected to WhatsApp');
    }

    // Get the connection and sync contacts
    const connection = this.baileysService.getConnection(deviceId);
    if (!connection) {
      throw new NotFoundException('WhatsApp connection not found');
    }

    return await this.whatsappSync.syncContacts(deviceId, connection);
  }

  async syncDeviceGroups(deviceId: string, userId: string, tenantId: string): Promise<any> {
    // Verify device ownership
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if device is connected
    const connectionStatus = await this.baileysService.getConnectionStatus(deviceId);
    if (!connectionStatus.isConnected) {
      throw new NotFoundException('Device not connected to WhatsApp');
    }

    // Get the connection and sync groups
    const connection = this.baileysService.getConnection(deviceId);
    if (!connection) {
      throw new NotFoundException('WhatsApp connection not found');
    }

    return await this.whatsappSync.syncGroups(deviceId, connection);
  }

  async getDeviceSyncStats(deviceId: string, userId: string, tenantId: string): Promise<any> {
    // Verify device ownership
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId }).exec();
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return await this.whatsappSync.getSyncStats(deviceId);
  }

  /**
   * Refresh all device connection statuses
   * Useful for bulk synchronization and debugging
   */
  async refreshAllDeviceConnectionStatuses(): Promise<any> {
    try {
      const result = await this.baileysService.refreshAllDeviceConnectionStatuses();
      
      this.logger.log(`Refreshed connection statuses for ${result.totalDevices} devices. Synced: ${result.syncedDevices}, Failed: ${result.failedDevices}`);
      
      return {
        message: `Connection statuses refreshed for ${result.totalDevices} devices`,
        totalDevices: result.totalDevices,
        syncedDevices: result.syncedDevices,
        failedDevices: result.failedDevices,
        results: result.results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Error refreshing all device connection statuses:', error.message);
      throw error;
    }
  }
}