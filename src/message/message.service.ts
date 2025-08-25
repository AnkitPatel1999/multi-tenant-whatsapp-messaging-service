import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppMessage, WhatsAppMessageDocument } from '../schema/whatsapp-message.schema';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel(WhatsAppMessage.name) private whatsappMessageModel: Model<WhatsAppMessageDocument>,
  ) {}

  async getMessages(tenantId: string, userId?: string, groupId?: string, limit: number = 50): Promise<any[]> {
    try {
      // Build filter for WhatsApp messages
      const filter: any = { isActive: true };
      
      if (tenantId) {
        filter.tenantId = tenantId;
      }
      
      if (userId) {
        filter.userId = userId;
      }
      
      if (groupId) {
        filter.chatId = groupId;
      }
      
      const messages = await this.whatsappMessageModel
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();

      // Format messages for consistent response
      return messages.map(msg => ({
        id: msg.messageId,
        content: msg.textContent || msg.caption || 'Media message',
        from: msg.fromJid,
        to: msg.toJid || msg.chatId,
        timestamp: msg.timestamp,
        type: msg.messageType || 'text',
        direction: msg.direction,
        userId: msg.userId,
        groupId: msg.groupSubject ? msg.chatId : undefined,
        source: 'whatsapp',
        status: msg.status,
        deviceId: msg.deviceId,
        chatId: msg.chatId,
        mediaUrl: msg.mediaUrl,
        isForwarded: msg.isForwarded,
        isDeleted: msg.isDeleted
      }));

    } catch (error) {
      this.logger.error('Error fetching messages:', error.message);
      throw error;
    }
  }

  async logMessage(messageData: Partial<WhatsAppMessage>): Promise<WhatsAppMessageDocument> {
    const message = new this.whatsappMessageModel({
      messageId: `MSG_${Date.now()}`,
      timestamp: new Date(),
      ...messageData,
    });

    return await message.save();
  }

  async findById(messageId: string): Promise<WhatsAppMessageDocument | null> {
    return await this.whatsappMessageModel.findOne({ messageId }).exec();
  }

  async updateMessageStatus(messageId: string, status: string): Promise<WhatsAppMessageDocument | null> {
    return await this.whatsappMessageModel.findOneAndUpdate(
      { messageId },
      { status },
      { new: true }
    ).exec();
  }

  async deleteOldMessages(cutoffDate: Date): Promise<number> {
    const result = await this.whatsappMessageModel.deleteMany({
      timestamp: { $lt: cutoffDate }
    }).exec();
    
    return result.deletedCount || 0;
  }
}
