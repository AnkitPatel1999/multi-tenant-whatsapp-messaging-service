import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageLog, MessageLogDocument } from '../schema/message-log.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel(MessageLog.name) private messageLogModel: Model<MessageLogDocument>,
  ) {}

  async getMessages(tenantId: string, userId?: string, groupId?: string, limit: number = 50): Promise<MessageLogDocument[]> {
    const filter: any = { tenantId };
    
    if (userId) filter.userId = userId;
    if (groupId) filter.groupId = groupId;

    return await this.messageLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async logMessage(messageData: Partial<MessageLog>): Promise<MessageLogDocument> {
    const messageLog = new this.messageLogModel({
      messageId: uuidv4(),
      timestamp: new Date(),
      ...messageData,
    });

    return await messageLog.save();
  }
}
