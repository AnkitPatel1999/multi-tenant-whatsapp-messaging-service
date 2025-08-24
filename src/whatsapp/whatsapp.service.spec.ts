import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppDevice, WhatsAppDeviceDocument } from '../schema/whatsapp-device.schema';
import { BaileysService } from './baileys.service';
import { WhatsAppSyncService } from './sync/whatsapp-sync.service';
import { MessageQueueService } from '../queue/services/message-queue.service';
import { CacheService } from '../cache/cache.service';

describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let deviceModel: jest.Mocked<Model<WhatsAppDeviceDocument>>;
  let baileysService: jest.Mocked<BaileysService>;
  let whatsappSync: jest.Mocked<WhatsAppSyncService>;
  let messageQueueService: jest.Mocked<MessageQueueService>;
  let cacheService: jest.Mocked<CacheService>;

  // Mock data
  const mockDevice = {
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    deviceName: 'Test Device',
    isActive: true,
    isConnected: true,
    lastConnectedAt: new Date(),
    save: jest.fn().mockResolvedValue({}),
    toObject: jest.fn().mockReturnValue({
      deviceId: 'device123',
      userId: 'user123',
      tenantId: 'tenant123',
      deviceName: 'Test Device',
      isActive: true,
      isConnected: true,
      lastConnectedAt: new Date(),
    })
  };

  const mockCreateDeviceData = {
    userId: 'user123',
    tenantId: 'tenant123',
    deviceName: 'Test Device',
    groupId: 'group123'
  };

  const mockSendMessageData = {
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    to: '+1234567890',
    message: 'Test message',
    type: 'text' as const,
  };

  const mockConnectionStatus = {
    deviceId: 'device123',
    isConnected: true,
    deviceInfo: null,
    hasQR: false
  };

  beforeEach(async () => {
    // Create a constructor function that acts as a Mongoose model
    const mockDeviceModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, deviceId: 'device123' })
    }));
    
    // Add static methods to the constructor function
    mockDeviceModel.findOne = jest.fn();
    mockDeviceModel.find = jest.fn();
    mockDeviceModel.deleteOne = jest.fn();

    const mockBaileysService = {
      createConnection: jest.fn(),
      getConnectionStatus: jest.fn(),
      sendMessage: jest.fn(),
      disconnectConnection: jest.fn(),
      clearDeviceSession: jest.fn(),
      forceReconnectDevice: jest.fn(),
      getDeviceRetryStatus: jest.fn(),
      getAllConnectedDevices: jest.fn(),
      getConnection: jest.fn(),
    };

    const mockWhatsAppSyncService = {
      getContacts: jest.fn(),
      searchContacts: jest.fn(),
      getGroups: jest.fn(),
      searchGroups: jest.fn(),
      syncContacts: jest.fn(),
      syncGroups: jest.fn(),
      getSyncStats: jest.fn(),
    };

    const mockMessageQueueService = {
      queueMessage: jest.fn(),
      queueBulkMessages: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: getModelToken(WhatsAppDevice.name), useValue: mockDeviceModel },
        { provide: BaileysService, useValue: mockBaileysService },
        { provide: WhatsAppSyncService, useValue: mockWhatsAppSyncService },
        { provide: MessageQueueService, useValue: mockMessageQueueService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    deviceModel = module.get(getModelToken(WhatsAppDevice.name));
    baileysService = module.get(BaileysService);
    whatsappSync = module.get(WhatsAppSyncService);
    messageQueueService = module.get(MessageQueueService);
    cacheService = module.get(CacheService);

    // Setup UUID mock
    jest.mock('uuid', () => ({
      v4: jest.fn(() => 'device123')
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevice', () => {
    it('should create a device successfully', async () => {
      // Arrange
      // deviceModel is now the constructor itself
      baileysService.createConnection.mockResolvedValue(undefined);

      // Act
      const result = await service.createDevice(mockCreateDeviceData);

      // Assert
      expect(deviceModel).toHaveBeenCalledWith({
        deviceId: expect.any(String),
        ...mockCreateDeviceData,
        isActive: true,
      });
      expect(baileysService.createConnection).toHaveBeenCalled();
      expect(result.deviceId).toBeDefined();
    });

    it('should create device even if Baileys connection fails', async () => {
      // Arrange
      // deviceModel is now the constructor itself
      baileysService.createConnection.mockRejectedValue(new Error('Connection failed'));

      // Act
      const result = await service.createDevice(mockCreateDeviceData);

      // Assert
      expect(deviceModel).toHaveBeenCalled();
      expect(baileysService.createConnection).toHaveBeenCalled();
      expect(result.deviceId).toBeDefined();
      // Should not throw error - device creation should succeed
    });
  });

  describe('getDevices', () => {
    it('should return devices with connection status', async () => {
      // Arrange
      const mockDevices = [mockDevice];
      deviceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevices)
      } as any);
      baileysService.getConnectionStatus.mockResolvedValue(mockConnectionStatus);

      // Act
      const result = await service.getDevices('user123', 'tenant123');

      // Assert
      expect(deviceModel.find).toHaveBeenCalledWith({
        userId: 'user123',
        tenantId: 'tenant123',
        isActive: true
      });
      expect(baileysService.getConnectionStatus).toHaveBeenCalledWith('device123');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('connectionStatus');
    });

    it('should throw NotFoundException when no devices found', async () => {
      // Arrange
      deviceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      } as any);

      // Act & Assert
      await expect(service.getDevices('user123', 'tenant123')).rejects.toThrow(NotFoundException);
      await expect(service.getDevices('user123', 'tenant123')).rejects.toThrow('Devices not found');
    });

    it('should handle connection status error gracefully', async () => {
      // Arrange
      const mockDevices = [mockDevice];
      deviceModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevices)
      } as any);
      baileysService.getConnectionStatus.mockRejectedValue(new Error('Status error'));

      // Act
      const result = await service.getDevices('user123', 'tenant123');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].connectionStatus).toEqual({
        deviceId: 'device123',
        isConnected: false,
        deviceInfo: null,
        hasQR: false
      });
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      cacheService.get.mockResolvedValue(null); // No cached data by default
      deviceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice)
      } as any);
      baileysService.getConnectionStatus.mockResolvedValue({
        ...mockConnectionStatus,
        isConnected: true
      });
    });

    it('should send message successfully', async () => {
      // Arrange
      const mockMessageResult = {
        success: true,
        messageId: 'msg123',
        timestamp: new Date()
      };
      baileysService.sendMessage.mockResolvedValue(mockMessageResult);

      // Act
      const result = await service.sendMessage(mockSendMessageData);

      // Assert
      expect(baileysService.sendMessage).toHaveBeenCalledWith(
        'device123',
        '+1234567890',
        'Test message',
        'text'
      );
      expect(result).toEqual({
        success: true,
        messageId: 'msg123',
        timestamp: expect.any(Date)
      });
    });

    it('should throw NotFoundException when device not found', async () => {
      // Arrange
      deviceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      // Act & Assert
      await expect(service.sendMessage(mockSendMessageData)).rejects.toThrow(NotFoundException);
      await expect(service.sendMessage(mockSendMessageData)).rejects.toThrow('Device not found');
    });

    it('should use cached device when available', async () => {
      // Arrange
      const cachedDevice = { ...mockDevice };
      cacheService.get.mockResolvedValueOnce(cachedDevice);
      const mockMessageResult = { success: true, messageId: 'msg123', timestamp: new Date() };
      baileysService.sendMessage.mockResolvedValue(mockMessageResult);

      // Act
      await service.sendMessage(mockSendMessageData);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith('device:device123:user123:tenant123');
      expect(deviceModel.findOne).not.toHaveBeenCalled();
      expect(baileysService.sendMessage).toHaveBeenCalled();
    });

    it('should throw NotFoundException when device not connected (cached status)', async () => {
      // Arrange
      const cachedStatus = { isConnected: false };
      // Mock the sequential cache calls: device cache (null), then status cache (not connected)
      cacheService.get
        .mockResolvedValueOnce(null) // First call for device cache
        .mockResolvedValueOnce(cachedStatus); // Second call for status cache
      
      deviceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice)
      } as any);

      // Act & Assert
      await expect(service.sendMessage(mockSendMessageData)).rejects.toThrow('Device not connected to WhatsApp. Please connect the device first.');
    });

    it('should retry failed message sending up to 3 times', async () => {
      // Arrange
      const mockMessageResult = { success: true, messageId: 'msg123', timestamp: new Date() };
      baileysService.sendMessage
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce(mockMessageResult);

      // Act
      const result = await service.sendMessage(mockSendMessageData);

      // Assert
      expect(baileysService.sendMessage).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        success: true,
        messageId: 'msg123',
        timestamp: expect.any(Date)
      });
    });

    it('should not retry for non-retryable errors', async () => {
      // Arrange
      baileysService.sendMessage.mockRejectedValue(new Error('Device not found'));

      // Act & Assert
      await expect(service.sendMessage(mockSendMessageData)).rejects.toThrow('Device not found');
      expect(baileysService.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should throw last error after all retries fail', async () => {
      // Arrange
      const lastError = new Error('Final failure');
      baileysService.sendMessage
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(lastError);

      // Act & Assert
      await expect(service.sendMessage(mockSendMessageData)).rejects.toThrow('Final failure');
      expect(baileysService.sendMessage).toHaveBeenCalledTimes(3);
    });

    it('should handle missing connection status cache', async () => {
      // Arrange
      cacheService.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null); // No cached status
      baileysService.getConnectionStatus.mockResolvedValue({ ...mockConnectionStatus, isConnected: true });
      const mockMessageResult = { success: true, messageId: 'msg123', timestamp: new Date() };
      baileysService.sendMessage.mockResolvedValue(mockMessageResult);

      // Act
      const result = await service.sendMessage(mockSendMessageData);

      // Assert
      expect(baileysService.getConnectionStatus).toHaveBeenCalledWith('device123');
      expect(cacheService.set).toHaveBeenCalledWith(
        'device_status:device123',
        expect.any(Object),
        300
      );
      expect(result.success).toBe(true);
    });
  });

  describe('queueMessage', () => {
    it('should queue message successfully', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      deviceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice)
      } as any);
      messageQueueService.queueMessage.mockResolvedValue('job123');

      // Act
      const result = await service.queueMessage(mockSendMessageData);

      // Assert
      expect(messageQueueService.queueMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        to: '+1234567890',
        message: 'Test message',
        type: 'text',
        priority: 'normal',
        scheduledAt: undefined,
        metadata: undefined,
      });
      expect(result).toEqual({
        jobId: 'job123',
        queued: true
      });
    });

    it('should queue message with custom priority', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      deviceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDevice)
      } as any);
      messageQueueService.queueMessage.mockResolvedValue('job123');
      
      const messageWithPriority = { ...mockSendMessageData, priority: 'high' as const };

      // Act
      const result = await service.queueMessage(messageWithPriority);

      // Assert
      expect(messageQueueService.queueMessage).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' })
      );
      expect(result.queued).toBe(true);
    });

    it('should throw NotFoundException when device not found for queuing', async () => {
      // Arrange
      cacheService.get.mockResolvedValue(null);
      deviceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      // Act & Assert
      await expect(service.queueMessage(mockSendMessageData)).rejects.toThrow(NotFoundException);
      await expect(service.queueMessage(mockSendMessageData)).rejects.toThrow('Device not found');
    });
  });

  describe('queueBulkMessages', () => {
    it('should queue bulk messages successfully', async () => {
      // Arrange
      const bulkMessages = [mockSendMessageData, { ...mockSendMessageData, to: '+0987654321' }];
      const mockJobIds = ['job123', 'job124'];
      messageQueueService.queueBulkMessages.mockResolvedValue(mockJobIds);

      // Act
      const result = await service.queueBulkMessages(bulkMessages);

      // Assert
      expect(messageQueueService.queueBulkMessages).toHaveBeenCalledWith([
        {
          deviceId: 'device123',
          userId: 'user123',
          tenantId: 'tenant123',
          to: '+1234567890',
          message: 'Test message',
          type: 'text',
          priority: 'normal',
          scheduledAt: undefined,
          metadata: undefined,
        },
        {
          deviceId: 'device123',
          userId: 'user123',
          tenantId: 'tenant123',
          to: '+0987654321',
          message: 'Test message',
          type: 'text',
          priority: 'normal',
          scheduledAt: undefined,
          metadata: undefined,
        }
      ]);
      expect(result).toEqual({
        jobIds: mockJobIds,
        queued: 2
      });
    });
  });

  describe('deleteDevice', () => {
    it('should delete device successfully', async () => {
      // Arrange
      deviceModel.deleteOne.mockResolvedValue({ deletedCount: 1 } as any);
      baileysService.disconnectConnection.mockResolvedValue(undefined);

      // Act
      const result = await service.deleteDevice('device123', 'user123', 'tenant123');

      // Assert
      expect(deviceModel.deleteOne).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123'
      });
      expect(baileysService.disconnectConnection).toHaveBeenCalledWith('device123');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when device not found for deletion', async () => {
      // Arrange
      deviceModel.deleteOne.mockResolvedValue({ deletedCount: 0 } as any);

      // Act & Assert
      await expect(service.deleteDevice('device123', 'user123', 'tenant123'))
        .rejects.toThrow(NotFoundException);
      await expect(service.deleteDevice('device123', 'user123', 'tenant123'))
        .rejects.toThrow('Device not found');
    });

    it('should handle disconnection error gracefully during deletion', async () => {
      // Arrange
      deviceModel.deleteOne.mockResolvedValue({ deletedCount: 1 } as any);
      baileysService.disconnectConnection.mockRejectedValue(new Error('Disconnect failed'));

      // Act
      const result = await service.deleteDevice('device123', 'user123', 'tenant123');

      // Assert
      expect(result).toEqual({ success: true });
      // Should not throw error even if disconnection fails
    });
  });
});
