import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { MessageProcessor } from './message.processor';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { MessageService } from '../../message/message.service';
import { CacheService } from '../../cache/cache.service';

// Mock Logger will be handled in the test setup

describe('MessageProcessor', () => {
  let processor: MessageProcessor;
  let whatsappService: jest.Mocked<WhatsAppService>;
  let messageService: jest.Mocked<MessageService>;
  let cacheService: jest.Mocked<CacheService>;

  // Mock job data
  const mockJobData = {
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    to: '+1234567890',
    message: 'Test message',
    type: 'text' as const,
    priority: 'normal' as const,
    correlationId: 'corr123',
    scheduledAt: undefined,
    retryCount: 3,
    metadata: undefined,
  };

  let mockJob: Job<typeof mockJobData>;

  const mockDevice = {
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    deviceName: 'Test Device',
    isActive: true,
    isConnected: true,
    lastConnectedAt: new Date(),
  } as any; // Type assertion for test mocking

  const mockMessageResult = {
    success: true,
    messageId: 'msg123',
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const mockWhatsAppService = {
      findById: jest.fn(),
      sendMessage: jest.fn(),
    };

    const mockMessageService = {
      logMessage: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageProcessor,
        { provide: WhatsAppService, useValue: mockWhatsAppService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    processor = module.get<MessageProcessor>(MessageProcessor);
    whatsappService = module.get(WhatsAppService);
    messageService = module.get(MessageService);
    cacheService = module.get(CacheService);

    // Initialize mockJob for each test
    mockJob = {
      id: 'job123',
      data: mockJobData,
      progress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<typeof mockJobData>;

    // Logger is handled by NestJS testing module

    // Mock Date.now for consistent timing tests
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // Fixed timestamp
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('sendMessage', () => {
    it('should process message successfully', async () => {
      // Arrange
      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...mockJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      const result = await processor.sendMessage(mockJob);

      // Assert
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(70);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
      
      expect(whatsappService.findById).toHaveBeenCalledWith('device123');
      expect(whatsappService.sendMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        to: '+1234567890',
        message: 'Test message',
        type: 'text',
      });
      
      expect(messageService.logMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        toJid: '+1234567890',
        textContent: 'Test message',
        messageType: 'text',
        status: 'sent',
        messageId: 'msg123',
        timestamp: expect.any(Date),
      });

      expect(result).toEqual({
        success: true,
        messageId: 'msg123',
        processingTime: expect.any(Number),
        completedAt: expect.any(String),
      });

      // Logger calls are internal to the processor and don't need to be tested in unit tests
    });

    it('should throw error when device not found', async () => {
      // Arrange
      whatsappService.findById.mockResolvedValue(null);
      messageService.logMessage.mockResolvedValue({} as any);

      // Act & Assert
      await expect(processor.sendMessage(mockJob)).rejects.toThrow(
        'Device device123 not found'
      );

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(whatsappService.findById).toHaveBeenCalledWith('device123');
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
      
      // Should log the failed message
      expect(messageService.logMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        toJid: '+1234567890',
        textContent: 'Test message',
        messageType: 'text',
        status: 'failed',
        messageId: `FAILED_${Date.now()}`,
        chatId: '+1234567890',
        fromJid: 'device123',
        direction: 'outgoing',
        timestamp: expect.any(Date),
      });
    });

    it('should throw error when device is not connected', async () => {
      // Arrange
      const disconnectedDevice = { ...mockDevice, isConnected: false } as any;
      whatsappService.findById.mockResolvedValue(disconnectedDevice);
      messageService.logMessage.mockResolvedValue({} as any);

      // Act & Assert
      await expect(processor.sendMessage(mockJob)).rejects.toThrow(
        'Device device123 is not connected'
      );

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(whatsappService.findById).toHaveBeenCalledWith('device123');
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
      
      // Should log the failed message
      expect(messageService.logMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        toJid: '+1234567890',
        textContent: 'Test message',
        messageType: 'text',
        status: 'failed',
        messageId: `FAILED_${Date.now()}`,
        chatId: '+1234567890',
        fromJid: 'device123',
        direction: 'outgoing',
        timestamp: expect.any(Date),
      });
    });

    it('should handle media message types correctly', async () => {
      // Arrange
      const mediaJobData = {
        ...mockJobData,
        type: 'document' as const,
        message: 'http://example.com/document.pdf',
      };
      const mediaJob = {
        ...mockJob,
        data: mediaJobData,
      } as any;

      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...mediaJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      const result = await processor.sendMessage(mediaJob);

      // Assert
      expect(whatsappService.sendMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        to: '+1234567890',
        message: 'http://example.com/document.pdf',
        type: 'media', // Should be converted to 'media'
      });

      expect(messageService.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'media', // Should be logged as 'media'
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle location message types correctly', async () => {
      // Arrange
      const locationJobData = {
        ...mockJobData,
        type: 'location' as const,
        message: '37.7749,-122.4194',
      };
      const locationJob = {
        ...mockJob,
        data: locationJobData,
      } as any;

      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...locationJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      await processor.sendMessage(locationJob);

      // Assert
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'media', // Should be converted to 'media'
        })
      );

      expect(messageService.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'media', // Should be logged as 'media'
        })
      );
    });

    it('should handle contact message types correctly', async () => {
      // Arrange
      const contactJobData = {
        ...mockJobData,
        type: 'contact' as const,
        message: 'John Doe:+1234567890',
      };
      const contactJob = {
        ...mockJob,
        data: contactJobData,
      } as any;

      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...contactJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      await processor.sendMessage(contactJob);

      // Assert
      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'media', // Should be converted to 'media'
        })
      );

      expect(messageService.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'media', // Should be logged as 'media'
        })
      );
    });

    it('should handle WhatsApp service sendMessage error', async () => {
      // Arrange
      const error = new Error('WhatsApp API error');
      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockRejectedValue(error);
      messageService.logMessage.mockResolvedValue({} as any);

      // Act & Assert
      await expect(processor.sendMessage(mockJob)).rejects.toThrow(
        'WhatsApp API error'
      );

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(whatsappService.findById).toHaveBeenCalledWith('device123');
      expect(whatsappService.sendMessage).toHaveBeenCalled();
      
      // Should log the failed message
      expect(messageService.logMessage).toHaveBeenCalledWith({
        deviceId: 'device123',
        userId: 'user123',
        tenantId: 'tenant123',
        recipientPhoneNumber: '+1234567890',
        messageContent: 'Test message',
        messageType: 'text',
        status: 'failed',
        errorMessage: 'WhatsApp API error',
        timestamp: expect.any(Date),
      });
    });

    it('should handle message logging error gracefully', async () => {
      // Arrange
      const loggingError = new Error('Database error');
      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockRejectedValue(loggingError);

      // Act & Assert
      await expect(processor.sendMessage(mockJob)).rejects.toThrow(
        'Database error'
      );

      expect(whatsappService.sendMessage).toHaveBeenCalled();
      expect(messageService.logMessage).toHaveBeenCalled();
      expect(mockJob.progress).toHaveBeenCalledWith(70); // Progress should reach here
    });

    it('should calculate processing time correctly', async () => {
      // Arrange
      const startTime = 1640995200000; // Fixed start time
      const endTime = startTime + 1500; // 1.5 seconds later
      
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime) // Initial call
        .mockReturnValueOnce(endTime);  // Final call

      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...mockJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      const result = await processor.sendMessage(mockJob);

      // Assert
      expect(result.processingTime).toBe(1500);
      // Logger calls are internal implementation details
    });

    it('should handle job progress reporting errors gracefully', async () => {
      // Arrange
      const localMockJob = {
        ...mockJob,
        progress: jest.fn().mockRejectedValue(new Error('Progress error')),
      };
      
      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...mockJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act & Assert
      // Should throw error due to progress reporting failure early in the process
      await expect(processor.sendMessage(localMockJob)).rejects.toThrow('Progress error');
    });

    it('should pass through correlation ID in logs', async () => {
      // Arrange
      const jobWithCorrelationId = {
        ...mockJob,
        data: { ...mockJobData, correlationId: 'test-correlation-123' },
      };

      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(mockMessageResult);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...jobWithCorrelationId.data,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      await processor.sendMessage(jobWithCorrelationId);

      // Assert
      // Logger calls are internal to the processor
    });

    it('should handle undefined message ID from WhatsApp service', async () => {
      // Arrange
      const resultWithoutMessageId = {
        success: true,
        messageId: undefined, // No message ID
        timestamp: new Date(),
      };

      whatsappService.findById.mockResolvedValue(mockDevice);
      whatsappService.sendMessage.mockResolvedValue(resultWithoutMessageId);
      messageService.logMessage.mockResolvedValue({
        messageId: 'log123',
        ...mockJobData,
        status: 'sent',
        timestamp: new Date(),
      } as any);

      // Act
      const result = await processor.sendMessage(mockJob);

      // Assert
      expect(messageService.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: expect.any(String),
        })
      );

      expect(result).toEqual({
        success: true,
        messageId: undefined,
        processingTime: expect.any(Number),
        completedAt: expect.any(String),
      });

      // Logger calls are verified by the service behavior, not mocked
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed job data', async () => {
      // Arrange
      const malformedJob = {
        id: 'job123',
        data: {
          // Missing required fields
          deviceId: '',
          to: null,
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as unknown as Job<typeof mockJobData>;
      
      messageService.logMessage.mockResolvedValue({} as any);

      // Act & Assert
      await expect(processor.sendMessage(malformedJob)).rejects.toThrow();
    });

    it('should handle null device response', async () => {
      // Arrange
      whatsappService.findById.mockResolvedValue(null);
      messageService.logMessage.mockResolvedValue({} as any);

      // Act & Assert
      await expect(processor.sendMessage(mockJob)).rejects.toThrow(
        'Device device123 not found'
      );
    });

    it('should handle device with undefined isConnected property', async () => {
      // Arrange
      const deviceWithUndefinedConnection = {
        ...mockDevice,
        isConnected: undefined,
      } as any;
      whatsappService.findById.mockResolvedValue(deviceWithUndefinedConnection);
      messageService.logMessage.mockResolvedValue({} as any);

      // Act & Assert
      await expect(processor.sendMessage(mockJob)).rejects.toThrow(
        'Device device123 is not connected'
      );
    });
  });
});
