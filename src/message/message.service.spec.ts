import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageService } from './message.service';
import { MessageLog, MessageLogDocument } from '../schema/message-log.schema';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'msg-uuid-123')
}));

describe('MessageService', () => {
  let service: MessageService;
  let messageLogModel: jest.Mocked<Model<MessageLogDocument>>;

  // Mock data
  const mockMessageData = {
    userId: 'user123',
    tenantId: 'tenant123',
    groupId: 'group123',
    deviceId: 'device123',
    to: '+1234567890',
    message: 'Test message',
    type: 'text',
    status: 'sent'
  };

  const mockMessageLog = {
    messageId: 'msg-uuid-123',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    ...mockMessageData,
    save: jest.fn().mockResolvedValue({
      messageId: 'msg-uuid-123',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      ...mockMessageData
    })
  };

  const mockSavedMessages = [
    {
      messageId: 'msg1',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      ...mockMessageData,
      message: 'First message'
    },
    {
      messageId: 'msg2',
      timestamp: new Date('2024-01-01T09:00:00Z'),
      ...mockMessageData,
      message: 'Second message'
    },
    {
      messageId: 'msg3',
      timestamp: new Date('2024-01-01T08:00:00Z'),
      ...mockMessageData,
      message: 'Third message'
    }
  ];

  beforeEach(async () => {
    // Create a constructor function that acts as a Mongoose model
    const mockMessageLogModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data)
    }));
    
    // Add static methods to the constructor function
    mockMessageLogModel.find = jest.fn();
    mockMessageLogModel.findOne = jest.fn();
    mockMessageLogModel.findOneAndUpdate = jest.fn();
    mockMessageLogModel.deleteMany = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: getModelToken(MessageLog.name), useValue: mockMessageLogModel },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    messageLogModel = module.get(getModelToken(MessageLog.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should return messages for a tenant with default limit', async () => {
      // Arrange
      const tenantId = 'tenant123';
      messageLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSavedMessages)
          })
        })
      } as any);

      // Act
      const result = await service.getMessages(tenantId);

      // Assert
      expect(messageLogModel.find).toHaveBeenCalledWith({ tenantId });
      expect(result).toEqual(mockSavedMessages);
    });

    it('should return messages filtered by userId', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const userId = 'user123';
      messageLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSavedMessages)
          })
        })
      } as any);

      // Act
      const result = await service.getMessages(tenantId, userId);

      // Assert
      expect(messageLogModel.find).toHaveBeenCalledWith({ tenantId, userId });
      expect(result).toEqual(mockSavedMessages);
    });

    it('should return messages filtered by userId and groupId', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const userId = 'user123';
      const groupId = 'group123';
      messageLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSavedMessages)
          })
        })
      } as any);

      // Act
      const result = await service.getMessages(tenantId, userId, groupId);

      // Assert
      expect(messageLogModel.find).toHaveBeenCalledWith({ tenantId, userId, groupId });
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
      messageLogModel.find.mockReturnValue({
        sort: mockSort
      });

      // Act
      const result = await service.getMessages(tenantId, undefined, undefined, customLimit);

      // Assert
      expect(messageLogModel.find).toHaveBeenCalledWith({ tenantId });
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
      messageLogModel.find.mockReturnValue({ sort: sortMock } as any);

      // Act
      await service.getMessages(tenantId);

      // Assert
      expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 });
    });

    it('should handle database query error', async () => {
      // Arrange
      const tenantId = 'tenant123';
      const error = new Error('Database connection failed');
      messageLogModel.find.mockReturnValue({
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
      const messageData = { ...mockMessageData };
      messageLogModel.mockImplementation(() => mockMessageLog);

      // Act
      const result = await service.logMessage(messageData);

      // Assert
      expect(messageLogModel).toHaveBeenCalledWith({
        messageId: 'msg-uuid-123',
        timestamp: expect.any(Date),
        ...messageData,
      });
      expect(mockMessageLog.save).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        messageId: 'msg-uuid-123',
        ...messageData
      }));
    });

    it('should log a message with partial data', async () => {
      // Arrange
      const partialData = {
        tenantId: 'tenant123',
        message: 'Partial message'
      };
      messageLogModel.mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(data)
      }));

      // Act
      const result = await service.logMessage(partialData);

      // Assert
      expect(messageLogModel).toHaveBeenCalledWith({
        messageId: 'msg-uuid-123',
        timestamp: expect.any(Date),
        ...partialData,
      });
      expect(result).toEqual(expect.objectContaining({
        messageId: 'msg-uuid-123',
        ...partialData
      }));
    });

    it('should handle save error', async () => {
      // Arrange
      const messageData = { ...mockMessageData };
      const error = new Error('Save failed');
      messageLogModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      // Act & Assert
      await expect(service.logMessage(messageData)).rejects.toThrow('Save failed');
    });
  });

  describe('findById', () => {
    it('should find message by messageId', async () => {
      // Arrange
      const messageId = 'msg-uuid-123';
      const expectedMessage = mockSavedMessages[0];
      messageLogModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(expectedMessage)
      } as any);

      // Act
      const result = await service.findById(messageId);

      // Assert
      expect(messageLogModel.findOne).toHaveBeenCalledWith({ messageId });
      expect(result).toEqual(expectedMessage);
    });

    it('should return null when message not found', async () => {
      // Arrange
      const messageId = 'non-existent-id';
      messageLogModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      // Act
      const result = await service.findById(messageId);

      // Assert
      expect(messageLogModel.findOne).toHaveBeenCalledWith({ messageId });
      expect(result).toBeNull();
    });

    it('should handle database query error', async () => {
      // Arrange
      const messageId = 'msg-uuid-123';
      const error = new Error('Query failed');
      messageLogModel.findOne.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error)
      } as any);

      // Act & Assert
      await expect(service.findById(messageId)).rejects.toThrow('Query failed');
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status and return updated document', async () => {
      // Arrange
      const messageId = 'msg-uuid-123';
      const newStatus = 'delivered';
      const updatedMessage = { ...mockSavedMessages[0], status: newStatus };
      
      messageLogModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedMessage)
      } as any);

      // Act
      const result = await service.updateMessageStatus(messageId, newStatus);

      // Assert
      expect(messageLogModel.findOneAndUpdate).toHaveBeenCalledWith(
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
      
      messageLogModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      } as any);

      // Act
      const result = await service.updateMessageStatus(messageId, newStatus);

      // Assert
      expect(messageLogModel.findOneAndUpdate).toHaveBeenCalledWith(
        { messageId },
        { status: newStatus },
        { new: true }
      );
      expect(result).toBeNull();
    });

    it('should handle update error', async () => {
      // Arrange
      const messageId = 'msg-uuid-123';
      const newStatus = 'delivered';
      const error = new Error('Update failed');
      
      messageLogModel.findOneAndUpdate.mockReturnValue({
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
      
      messageLogModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult)
      } as any);

      // Act
      const result = await service.deleteOldMessages(cutoffDate);

      // Assert
      expect(messageLogModel.deleteMany).toHaveBeenCalledWith({
        timestamp: { $lt: cutoffDate }
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no messages deleted', async () => {
      // Arrange
      const cutoffDate = new Date('2024-01-01T00:00:00Z');
      const mockResult = { deletedCount: 0 };
      
      messageLogModel.deleteMany.mockReturnValue({
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
      
      messageLogModel.deleteMany.mockReturnValue({
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
      
      messageLogModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error)
      } as any);

      // Act & Assert
      await expect(service.deleteOldMessages(cutoffDate)).rejects.toThrow('Delete operation failed');
    });

    it('should use correct query for date filter', async () => {
      // Arrange
      const cutoffDate = new Date('2023-12-31T23:59:59Z');
      const mockResult = { deletedCount: 3 };
      
      messageLogModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult)
      } as any);

      // Act
      await service.deleteOldMessages(cutoffDate);

      // Assert
      expect(messageLogModel.deleteMany).toHaveBeenCalledWith({
        timestamp: { $lt: cutoffDate }
      });
    });
  });
});
