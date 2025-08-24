import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppMessage, WhatsAppMessageDocument } from '../../schema/whatsapp-message.schema';

@Injectable()
export class WhatsAppMessageService {
  private readonly logger = new Logger(WhatsAppMessageService.name);

  constructor(
    @InjectModel(WhatsAppMessage.name)
    private readonly messageModel: Model<WhatsAppMessageDocument>,
  ) {}

  /**
   * Store a WhatsApp message in the database
   */
  async storeMessage(messageData: Partial<WhatsAppMessage>): Promise<WhatsAppMessageDocument> {
    console.log('🔄 [DB STORE] Attempting to store WhatsApp message:', {
      messageId: messageData.messageId,
      deviceId: messageData.deviceId,
      direction: messageData.direction,
      messageType: messageData.messageType,
      textContent: messageData.textContent?.substring(0, 50) + '...',
      chatId: messageData.chatId,
      timestamp: messageData.timestamp
    });

    try {
      // Check if message already exists to avoid duplicates
      const existingMessage = await this.messageModel.findOne({
        deviceId: messageData.deviceId,
        messageId: messageData.messageId
      }).exec();

      if (existingMessage) {
        console.log('⚠️ [DB STORE] Message already exists, skipping:', {
          messageId: messageData.messageId,
          deviceId: messageData.deviceId
        });
        this.logger.debug(`Message ${messageData.messageId} already exists, skipping storage`);
        return existingMessage;
      }

      const message = new this.messageModel(messageData);
      const savedMessage = await message.save();
      
      console.log('✅ [DB STORE] SUCCESS - Message stored in database:', {
        messageId: messageData.messageId,
        deviceId: messageData.deviceId,
        direction: messageData.direction,
        messageType: messageData.messageType,
        chatId: messageData.chatId,
        storedAt: new Date().toISOString(),
        dbId: savedMessage._id
      });
      
      this.logger.debug(`Stored message ${messageData.messageId} for device ${messageData.deviceId}`);
      return savedMessage;
    } catch (error) {
      console.error('❌ [DB STORE] FAILED - Error storing message in database:', {
        messageId: messageData.messageId,
        deviceId: messageData.deviceId,
        error: error.message,
        stack: error.stack
      });
      this.logger.error(`Error storing message ${messageData.messageId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get messages for a specific chat
   */
  async getChatMessages(
    deviceId: string,
    chatId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<WhatsAppMessageDocument[]> {
    try {
      return await this.messageModel
        .find({
          deviceId,
          chatId,
          isActive: true
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(offset)
        .exec();
    } catch (error) {
      this.logger.error(`Error getting chat messages for ${chatId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get all messages for a device
   */
  async getDeviceMessages(
    deviceId: string,
    userId: string,
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<WhatsAppMessageDocument[]> {
    try {
      return await this.messageModel
        .find({
          deviceId,
          userId,
          tenantId,
          isActive: true
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(offset)
        .exec();
    } catch (error) {
      this.logger.error(`Error getting device messages for ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Search messages by text content
   */
  async searchMessages(
    deviceId: string,
    userId: string,
    tenantId: string,
    searchQuery: string,
    limit: number = 50
  ): Promise<WhatsAppMessageDocument[]> {
    try {
      return await this.messageModel
        .find({
          deviceId,
          userId,
          tenantId,
          isActive: true,
          $or: [
            { textContent: { $regex: searchQuery, $options: 'i' } },
            { caption: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error(`Error searching messages:`, error.message);
      throw error;
    }
  }

  /**
   * Update message status (delivered, read, etc.)
   */
  async updateMessageStatus(
    deviceId: string,
    messageId: string,
    status: string
  ): Promise<WhatsAppMessageDocument | null> {
    try {
      return await this.messageModel.findOneAndUpdate(
        { deviceId, messageId },
        { status, updatedAt: new Date() },
        { new: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Error updating message status:`, error.message);
      throw error;
    }
  }

  /**
   * Mark message as deleted
   */
  async markMessageDeleted(
    deviceId: string,
    messageId: string
  ): Promise<WhatsAppMessageDocument | null> {
    try {
      return await this.messageModel.findOneAndUpdate(
        { deviceId, messageId },
        { isDeleted: true, updatedAt: new Date() },
        { new: true }
      ).exec();
    } catch (error) {
      this.logger.error(`Error marking message as deleted:`, error.message);
      throw error;
    }
  }

  /**
   * Get message statistics for a device
   */
  async getMessageStats(deviceId: string, userId: string, tenantId: string): Promise<any> {
    try {
      const stats = await this.messageModel.aggregate([
        { $match: { deviceId, userId, tenantId, isActive: true } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            incomingMessages: {
              $sum: { $cond: [{ $eq: ['$direction', 'incoming'] }, 1, 0] }
            },
            outgoingMessages: {
              $sum: { $cond: [{ $eq: ['$direction', 'outgoing'] }, 1, 0] }
            },
            messageTypes: {
              $push: '$messageType'
            },
            latestMessage: { $max: '$timestamp' },
            oldestMessage: { $min: '$timestamp' }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          totalMessages: 0,
          incomingMessages: 0,
          outgoingMessages: 0,
          messageTypes: {},
          latestMessage: null,
          oldestMessage: null
        };
      }

      const result = stats[0];
      
      // Count message types
      const messageTypeCounts = result.messageTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalMessages: result.totalMessages,
        incomingMessages: result.incomingMessages,
        outgoingMessages: result.outgoingMessages,
        messageTypes: messageTypeCounts,
        latestMessage: result.latestMessage,
        oldestMessage: result.oldestMessage
      };
    } catch (error) {
      this.logger.error(`Error getting message stats:`, error.message);
      return null;
    }
  }

  /**
   * Parse Baileys message to our message format
   */
  parseMessage(
    deviceId: string,
    userId: string,
    tenantId: string,
    baileysMessage: any,
    direction: 'incoming' | 'outgoing'
  ): Partial<WhatsAppMessage> | null {
    console.log('🔄 [PARSE] Attempting to parse WhatsApp message:', {
      deviceId,
      direction,
      messageId: baileysMessage.key?.id,
      remoteJid: baileysMessage.key?.remoteJid,
      fromMe: baileysMessage.key?.fromMe,
      timestamp: baileysMessage.messageTimestamp,
      messageTypes: Object.keys(baileysMessage.message || {})
    });

    try {
      const messageKey = baileysMessage.key;
      const messageContent = baileysMessage.message;
      
      if (!messageKey || !messageContent) {
        console.log('❌ [PARSE] FAILED - Missing message key or content:', {
          hasKey: !!messageKey,
          hasContent: !!messageContent,
          messageId: messageKey?.id
        });
        return null;
      }

      const parsedMessage: Partial<WhatsAppMessage> = {
        deviceId,
        userId,
        tenantId,
        messageId: messageKey.id,
        chatId: messageKey.remoteJid,
        fromJid: messageKey.fromMe ? `${deviceId}@s.whatsapp.net` : messageKey.remoteJid,
        direction,
        timestamp: new Date(baileysMessage.messageTimestamp * 1000),
        status: 'sent',
        isActive: true,
        rawMessage: baileysMessage
      };

      // Parse different message types
      if (messageContent.conversation) {
        parsedMessage.messageType = 'text';
        parsedMessage.textContent = messageContent.conversation;
      } else if (messageContent.extendedTextMessage) {
        parsedMessage.messageType = 'text';
        parsedMessage.textContent = messageContent.extendedTextMessage.text;
        
        // Handle quoted messages
        if (messageContent.extendedTextMessage.contextInfo?.quotedMessage) {
          const quoted = messageContent.extendedTextMessage.contextInfo;
          parsedMessage.quotedMessageId = quoted.stanzaId;
          parsedMessage.quotedMessage = {
            messageId: quoted.stanzaId,
            content: quoted.quotedMessage?.conversation || 'Media message',
            sender: quoted.participant
          };
        }
      } else if (messageContent.imageMessage) {
        parsedMessage.messageType = 'image';
        parsedMessage.caption = messageContent.imageMessage.caption;
        parsedMessage.mediaType = messageContent.imageMessage.mimetype;
        parsedMessage.mediaSize = messageContent.imageMessage.fileLength;
        parsedMessage.fileName = messageContent.imageMessage.fileName;
      } else if (messageContent.videoMessage) {
        parsedMessage.messageType = 'video';
        parsedMessage.caption = messageContent.videoMessage.caption;
        parsedMessage.mediaType = messageContent.videoMessage.mimetype;
        parsedMessage.mediaSize = messageContent.videoMessage.fileLength;
        parsedMessage.fileName = messageContent.videoMessage.fileName;
      } else if (messageContent.audioMessage) {
        parsedMessage.messageType = 'audio';
        parsedMessage.mediaType = messageContent.audioMessage.mimetype;
        parsedMessage.mediaSize = messageContent.audioMessage.fileLength;
      } else if (messageContent.documentMessage) {
        parsedMessage.messageType = 'document';
        parsedMessage.mediaType = messageContent.documentMessage.mimetype;
        parsedMessage.mediaSize = messageContent.documentMessage.fileLength;
        parsedMessage.fileName = messageContent.documentMessage.fileName;
        parsedMessage.caption = messageContent.documentMessage.caption;
      } else if (messageContent.stickerMessage) {
        parsedMessage.messageType = 'sticker';
        parsedMessage.mediaType = messageContent.stickerMessage.mimetype;
        parsedMessage.mediaSize = messageContent.stickerMessage.fileLength;
      } else if (messageContent.locationMessage) {
        parsedMessage.messageType = 'location';
        parsedMessage.location = {
          latitude: messageContent.locationMessage.degreesLatitude,
          longitude: messageContent.locationMessage.degreesLongitude,
          address: messageContent.locationMessage.address
        };
      } else if (messageContent.contactMessage) {
        parsedMessage.messageType = 'contact';
        parsedMessage.contact = {
          displayName: messageContent.contactMessage.displayName,
          vcard: messageContent.contactMessage.vcard
        };
      } else {
        parsedMessage.messageType = 'other';
      }

      // Handle mentions
      if (messageContent.extendedTextMessage?.contextInfo?.mentionedJid) {
        parsedMessage.mentionedJids = messageContent.extendedTextMessage.contextInfo.mentionedJid;
      }

      // Handle forwarded messages
      if (messageContent.extendedTextMessage?.contextInfo?.forwardingScore > 0) {
        parsedMessage.isForwarded = true;
      }

      // Set recipient for outgoing messages
      if (direction === 'outgoing') {
        parsedMessage.toJid = messageKey.remoteJid;
      }

      console.log('✅ [PARSE] SUCCESS - Message parsed successfully:', {
        messageId: parsedMessage.messageId,
        deviceId: parsedMessage.deviceId,
        direction: parsedMessage.direction,
        messageType: parsedMessage.messageType,
        chatId: parsedMessage.chatId,
        fromJid: parsedMessage.fromJid,
        textContent: parsedMessage.textContent?.substring(0, 100) + '...',
        hasMedia: !!(parsedMessage.mediaType || parsedMessage.fileName),
        timestamp: parsedMessage.timestamp
      });

      return parsedMessage;
    } catch (error) {
      console.error('❌ [PARSE] FAILED - Error parsing message:', {
        deviceId,
        messageId: baileysMessage.key?.id,
        error: error.message,
        stack: error.stack
      });
      this.logger.error(`Error parsing message:`, error.message);
      return null;
    }
  }
}
