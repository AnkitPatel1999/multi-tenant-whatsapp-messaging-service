import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageService } from './message.service';
import { WhatsAppMessage, WhatsAppMessageDocument } from '../schema/whatsapp-message.schema';

describe('MessageService', () => {
  let service: MessageService;
  let whatsappMessageModel: Model<WhatsAppMessageDocument>;

  const mockWhatsAppMessage = {
    messageId: 'MSG_123',
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    chatId: 'chat123',
    fromJid: 'from123',
    toJid: 'to123',
    textContent: 'Test message',
    messageType: 'text',
    direction: 'incoming',
    status: 'sent',
    timestamp: new Date(),
    isActive: true,
  };

  const mockSavedMessages = [
    {
      messageId: 'MSG_1',
      deviceId: 'device123',
      userId: 'user123',
      tenantId: 'tenant123',
      chatId: 'chat123',
      fromJid: 'from123',
      toJid: 'to123',
      textContent: 'First message',
      messageType: 'text',
      direction: 'incoming',
      status: 'sent',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      isActive: true,
    },
    {
      messageId: 'MSG_2',
      deviceId: 'device123',
      userId: 'user123',
      tenantId: 'tenant123',
      chatId: 'chat123',
      fromJid: 'from123',
      toJid: 'to123',
      textContent: 'Second message',
      messageType: 'text',
      direction: 'incoming',
      status: 'sent',
      timestamp: new Date('2024-01-01T09:00:00Z'),
      isActive: true,
    },
  ];

  const mockWhatsAppMessageModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteMany: jest.fn(),
    new: jest.fn().mockImplementation((data) => ({
      ...mockWhatsAppMessage,
      ...data,
      save: jest.fn().mockResolvedValue({
        ...mockWhatsAppMessage,
        ...data,
      }),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: getModelToken(WhatsAppMessage.name), useValue: mockWhatsAppMessageModel },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    whatsappMessageModel = module.get(getModelToken(WhatsAppMessage.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should return messages for a tenant with default limit', async () => {
      // Arrange
      const tenantId = 'tenant123';
      whatsappMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSavedMessages)
          })
        })
      } as any);

      // Act
      const result = await service.getMessages(tenantId);

      // Assert
      expect(whatsappMessageModel.find).toHaveBeenCalledWith({ tenantId });
      expect(result).toEqual(mockSavedMessages);
    });

    it('should return messages filtered by userId', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const userId = 'user123';
      whatsappMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSavedMessages)
          })
        })
      } as any);

      // Act
      const result = await service.getMessages(tenantId, userId);

      // Assert
      expect(whatsappMessageModel.find).toHaveBeenCalledWith({ tenantId, userId });
      expect(result).toEqual(mockSavedMessages);
    });

    it('should return messages filtered by userId and groupId', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const userId = 'user123';
      const groupId = 'group123';
      whatsappMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSavedMessages)
          })
        })
      } as any);

      // Act
      const result = await service.getMessages(tenantId, userId, groupId);

      // Assert
      expect(whatsappMessageModel.find).toHaveBeenCalledWith({ tenantId, userId, groupId });
      expect(result).toEqual(mockSavedMessages);
    });

    it('should return messages with custom limit', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const customLimit = 100;
      const mockLimit = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSavedMessages)
      });
      const mockSort = jest.fn().mockReturnValue({
        limit: mockLimit
      });
      whatsappMessageModel.find.mockReturnValue({
        sort: mockSort
      });

      // Act
      const result = await service.getMessages(tenantId, undefined, undefined, customLimit);

      // Assert
      expect(whatsappMessageModel.find).toHaveBeenCalledWith({ tenantId });
      expect(mockSort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockLimit).toHaveBeenCalledWith(customLimit);
      expect(result).toEqual(mockSavedMessages);
    });

    it('should sort messages by timestamp in descending order', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const sortMock = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSavedMessages)
        })
      });
      whatsappMessageModel.find.mockReturnValue({ sort: sortMock } as any);

      // Act
      await service.getMessages(tenantId);

      // Assert
      expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 });
    });

    it('should handle database query error', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const error = new Error('Database connection failed');
      whatsappMessageModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockRejectedValue(error)
          })
        })
      } as any);

      // Act & Assert
      await expect(service.getMessages(tenantId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('logMessage', () => {
    beforeEach(() => {
      // Mock Date for consistent testing
      jest.spyOn(Date.prototype, 'getTime').mockReturnValue(new Date('2024-01-01T00:00:00Z').getTime());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log a message with generated messageId and timestamp', async () => {
      // Arrange
      const messageData = { ...mockWhatsAppMessage };
      whatsappMessageModel.new.mockReturnValue(mockWhatsAppMessage);

      // Act
      const result = await service.logMessage(messageData);

      // Assert
      expect(whatsappMessageModel.new).toHaveBeenCalledWith({
        messageId: 'MSG_123',
        timestamp: expect.any(Date),
        ...messageData,
      });
      expect(mockWhatsAppMessage.save).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        messageId: 'MSG_123',
        ...messageData
      }));
    });

    it('should log a message with partial data', async () => {
      // Arrange
      const partialData = {
        tenantId: 'tenant123',
        message: 'Partial message'
      };
      whatsappMessageModel.new.mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(data)
      }));

      // Act
      const result = await service.logMessage(partialData);

      // Assert
      expect(whatsappMessageModel.new).toHaveBeenCalledWith({
        messageId: 'MSG_123',
        timestamp: expect.any(Date),
        ...partialData,
      });
      expect(result).toEqual(expect.objectContaining({
        messageId: 'MSG_123',
        ...partialData
      }));
    });

    it('should handle save error', async () => {
      // Arrange
      const messageData = { ...mockWhatsAppMessage };
      const error = new Error('Save failed');
      whatsappMessageModel.new.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      // Act & Assert
      await expect(service.logMessage(messageData)).rejects.toThrow('Save failed');
    });
  });

  describe('findById', () => {
    it('should find message by messageId', async () => {
      // Arrange
      const messageId = 'MSG_123';
      const expectedMessage = mockSavedMessages[0];
      whatsappMessageModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(expectedMessage)
      } as any);

      // Act
      const result = await service.findById(messageId);

      // Assert
      expect(whatsappMessageModel.findOne).toHaveBeenCalledWith({ messageId });
      expect(result).toEqual(expectedMessage);
    });

    it('should return null when message not found', async () => {
      // Arrange
      const messageId = 'non-existent-id';
      whatsappMessageModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      // Act
      const result = await service.findById(messageId);

      // Assert
      expect(whatsappMessageModel.findOne).toHaveBeenCalledWith({ messageId });
      expect(result).toBeNull();
    });

    it('should handle database query error', async () => {
      // Arrange
      const messageId = 'MSG_123';
      const error = new Error('Query failed');
      whatsappMessageModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error)
      } as any);

      // Act & Assert
      await expect(service.findById(messageId)).rejects.toThrow('Query failed');
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status and return updated document', async () => {
      // Arrange
      const messageId = 'MSG_123';
      const newStatus = 'delivered';
      const updatedMessage = { ...mockSavedMessages[0], status: newStatus };
      
      whatsappMessageModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedMessage)
      } as any);

      // Act
      const result = await service.updateMessageStatus(messageId, newStatus);

      // Assert
      expect(whatsappMessageModel.findOneAndUpdate).toHaveBeenCalledWith(
        { messageId },
        { status: newStatus },
        { new: true }
      );
      expect(result).toEqual(updatedMessage);
    });

    it('should return null when message not found for update', async () => {
      // Arrange
      const messageId = 'non-existent-id';
      const newStatus = 'delivered';
      
      whatsappMessageModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      // Act
      const result = await service.updateMessageStatus(messageId, newStatus);

      // Assert
      expect(whatsappMessageModel.findOneAndUpdate).toHaveBeenCalledWith(
        { messageId },
        { status: newStatus },
        { new: true }
      );
      expect(result).toBeNull();
    });

    it('should handle update error', async () => {
      // Arrange
      const messageId = 'MSG_123';
      const newStatus = 'delivered';
      const error = new Error('Update failed');
      
      whatsappMessageModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error)
      } as any);

      // Act & Assert
      await expect(service.updateMessageStatus(messageId, newStatus)).rejects.toThrow('Update failed');
    });
  });

  describe('deleteOldMessages', () => {
    it('should delete old messages and return count', async () => {
      // Arrange
      const cutoffDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = { deletedCount: 5 };
      
      whatsappMessageModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult)
      } as any);

      // Act
      const result = await service.deleteOldMessages(cutoffDate);

      // Assert
      expect(whatsappMessageModel.deleteMany).toHaveBeenCalledWith({
        timestamp: { $lt: cutoffDate }
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no messages deleted', async () => {
      // Arrange
      const cutoffDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = { deletedCount: 0 };
      
      whatsappMessageModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult)
      } as any);

      // Act
      const result = await service.deleteOldMessages(cutoffDate);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle deletedCount being undefined', async () => {
      // Arrange
      const cutoffDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = {}; // No deletedCount property
      
      whatsappMessageModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult)
      } as any);

      // Act
      const result = await service.deleteOldMessages(cutoffDate);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle delete error', async () => {
      // Arrange
      const cutoffDate = new Date('2024-01-01T00:00:00Z');
      const error = new Error('Delete operation failed');
      
      whatsappMessageModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error)
      } as any);

      // Act & Assert
      await expect(service.deleteOldMessages(cutoffDate)).rejects.toThrow('Delete operation failed');
    });

    it('should use correct query for date filter', async () => {
      // Arrange
      const cutoffDate = new Date('2023-12-31T23:59:59Z');
      const mockResult = { deletedCount: 3 };
      
      whatsappMessageModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult)
      } as any);

      // Act
      await service.deleteOldMessages(cutoffDate);

      // Assert
      expect(whatsappMessageModel.deleteMany).toHaveBeenCalledWith({
        timestamp: { $lt: cutoffDate }
      });
    });
  });
});
