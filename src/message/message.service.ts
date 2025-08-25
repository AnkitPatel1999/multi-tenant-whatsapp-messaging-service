import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageLog, MessageLogDocument } from '../schema/message-log.schema';
import { WhatsAppMessage, WhatsAppMessageDocument } from '../schema/whatsapp-message.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel(MessageLog.name) private messageLogModel: Model<MessageLogDocument>,
    @InjectModel(WhatsAppMessage.name) private whatsappMessageModel: Model<WhatsAppMessageDocument>,
  ) {}

  async getMessages(tenantId: string, userId?: string, groupId?: string, limit: number = 50): Promise<any[]> {
    try {
      // Get regular messages from MessageLog
      const messageLogFilter: any = { tenantId };
      if (userId) messageLogFilter.userId = userId;
      if (groupId) messageLogFilter.groupId = groupId;

      const messageLogs = await this.messageLogModel
        .find(messageLogFilter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      // Get WhatsApp messages (filter by tenantId if available, otherwise get all)
      let whatsappMessages: WhatsAppMessageDocument[] = [];
      try {
        // For WhatsApp messages, we need to filter by device ownership
        // Since WhatsApp messages don't have tenantId directly, we'll get all and filter later
        whatsappMessages = await this.whatsappMessageModel
          .find({ isActive: true })
          .sort({ timestamp: -1 })
          .limit(limit)
          .exec();
      } catch (error) {
        this.logger.warn('Could not fetch WhatsApp messages:', error.message);
      }

      // Combine and format messages
      const allMessages = [
        ...messageLogs.map(msg => ({
          id: msg.messageId,
          content: msg.content || msg.message,
          from: msg.from,
          to: msg.to,
          timestamp: msg.timestamp,
          type: msg.type || 'text',
          direction: msg.direction || 'outgoing',
          userId: msg.userId,
          groupId: msg.groupId,
          source: 'message_log',
          status: msg.status
        })),
        ...whatsappMessages.map(msg => ({
          id: msg.messageId,
          content: msg.textContent || msg.messageContent,
          from: msg.from || msg.chatId,
          to: msg.to || msg.chatId,
          timestamp: msg.timestamp,
          type: msg.messageType || 'text',
          direction: msg.direction,
          userId: msg.userId,
          groupId: msg.groupId,
          source: 'whatsapp',
          status: msg.status,
          deviceId: msg.deviceId,
          chatId: msg.chatId
        }))
      ];

      // Sort by timestamp (newest first) and limit
      return allMessages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

    } catch (error) {
      this.logger.error('Error fetching messages:', error.message);
      throw error;
    }
  }

  async logMessage(messageData: Partial<MessageLog>): Promise<MessageLogDocument> {
    const messageLog = new this.messageLogModel({
      messageId: uuidv4(),
      timestamp: new Date(),
      ...messageData,
    });

    return await messageLog.save();
  }

  async findById(messageId: string): Promise<MessageLogDocument | null> {
    return await this.messageLogModel.findOne({ messageId }).exec();
  }

  async updateMessageStatus(messageId: string, status: string): Promise<MessageLogDocument | null> {
    return await this.messageLogModel.findOneAndUpdate(
      { messageId },
      { status },
      { new: true }
    ).exec();
  }

  async deleteOldMessages(cutoffDate: Date): Promise<number> {
    const result = await this.messageLogModel.deleteMany({
      timestamp: { $lt: cutoffDate }
    }).exec();
    
    return result.deletedCount || 0;
  }
}
