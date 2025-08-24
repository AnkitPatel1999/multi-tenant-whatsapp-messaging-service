import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppDevice, WhatsAppDeviceDocument } from '../schema/whatsapp-device.schema';
import { BaileysService } from './baileys.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectModel(WhatsAppDevice.name) private deviceModel: Model<WhatsAppDeviceDocument>,
    private baileysService: BaileysService,
  ) {}

  async createDevice(userId: string, tenantId: string, deviceName: string): Promise<WhatsAppDeviceDocument> {
    const deviceId = uuidv4();
    
    const device = new this.deviceModel({
      deviceId,
      userId,
      tenantId,
      deviceName,
      isActive: true,
    });

    await device.save();
    
    // Create Baileys connection
    await this.baileysService.createConnection(deviceId, userId, tenantId);
    
    return device;
  }

  async getDevices(userId: string, tenantId: string): Promise<any[]> {
    const devices = await this.deviceModel.find({ userId, tenantId, isActive: true });
    
    // Get connection status for each device
    const devicesWithStatus = await Promise.all(
      devices.map(async (device) => {
        const status = await this.baileysService.getConnectionStatus(device.deviceId);
        return { ...device.toObject(), connectionStatus: status };
      })
    );
    
    return devicesWithStatus;
  }

  async generateQRCode(deviceId: string, userId: string, tenantId: string): Promise<any> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId });
    if (!device) {
      throw new Error('Device not found');
    }

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
  }

  async sendMessage(deviceId: string, userId: string, tenantId: string, to: string, message: string, type: 'text' | 'media' = 'text'): Promise<any> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId });
    if (!device) {
      throw new Error('Device not found');
    }

    if (!device.isConnected) {
      throw new Error('Device not connected');
    }

    const result = await this.baileysService.sendMessage(deviceId, to, message, type);
    
    return {
      success: true,
      messageId: result.messageId,
      timestamp: new Date(),
    };
  }

  async disconnectDevice(deviceId: string, userId: string, tenantId: string): Promise<any> {
    const device = await this.deviceModel.findOne({ deviceId, userId, tenantId });
    if (!device) {
      throw new Error('Device not found');
    }

    // Disconnect from Baileys
    await this.baileysService.disconnectConnection(deviceId);
    
    // Update device status
    device.isConnected = false;
    device.lastConnectedAt = new Date();
    await device.save();
    
    return { success: true, message: 'Device disconnected successfully' };
  }
}