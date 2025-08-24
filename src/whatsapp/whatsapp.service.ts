import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppDevice, WhatsAppDeviceDocument } from '../schema/whatsapp-device.schema';
import { BaileysService } from './baileys.service';
import { v4 as uuidv4 } from 'uuid';
import { 
  CreateDeviceData, 
  SendMessageData, 
  WhatsAppConnectionResult,
  WhatsAppMessageResult,
  WhatsAppQRResult 
} from '../dto/whatsapp.dto';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectModel(WhatsAppDevice.name) private deviceModel: Model<WhatsAppDeviceDocument>,
    private baileysService: BaileysService,
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
    
    // Get connection status for each device
    const devicesWithStatus = await Promise.all(
      devices.map(async (device) => {
        try {
          const status = await this.baileysService.getConnectionStatus(device.deviceId);
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
      
      return {
        deviceId,
        qrCode: status.deviceInfo?.qrCode,
        qrExpiry: status.deviceInfo?.qrExpiry,
        isConnected: status.isConnected,
      };
    } catch (error) {
      this.logger.error(`Error generating QR code for device ${deviceId}:`, error.message);
      // Return safe defaults instead of crashing
      return {
        deviceId,
        qrCode: undefined,
        qrExpiry: undefined,
        isConnected: false,
      };
    }
  }

  async sendMessage(sendMessageData: SendMessageData): Promise<WhatsAppMessageResult> {
    const device = await this.deviceModel.findOne({ 
      deviceId: sendMessageData.deviceId, 
      userId: sendMessageData.userId, 
      tenantId: sendMessageData.tenantId 
    }).exec();
    
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check actual connection status from BaileysService instead of database
    try {
      const connectionStatus = await this.baileysService.getConnectionStatus(sendMessageData.deviceId);
      if (!connectionStatus.isConnected) {
        throw new NotFoundException('Device not connected to WhatsApp. Please connect the device first.');
      }
    } catch (error) {
      this.logger.error(`Error checking connection status for device ${sendMessageData.deviceId}:`, error.message);
      throw new NotFoundException('Device not connected to WhatsApp. Please connect the device first.');
    }

    try {
      const result = await this.baileysService.sendMessage(
        sendMessageData.deviceId, 
        sendMessageData.to, 
        sendMessageData.message, 
        sendMessageData.type || 'text'
      );
      
      // Ensure we return a proper result structure
      return {
        success: result?.success || false,
        messageId: result?.messageId || undefined,
        timestamp: result?.timestamp || new Date()
      };
    } catch (error) {
      this.logger.error(`Error sending message from device ${sendMessageData.deviceId}:`, error.message);
      throw error;
    }
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
}