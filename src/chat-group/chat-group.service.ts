import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatGroup, ChatGroupDocument } from '../schema/chat-group.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatGroupService {
  private readonly logger = new Logger(ChatGroupService.name);

  constructor(
    @InjectModel(ChatGroup.name) private chatGroupModel: Model<ChatGroupDocument>,
  ) {}

  async getGroups(tenantId: string, userId?: string): Promise<ChatGroupDocument[]> {
    try {
      const filter: any = { tenantId, isActive: true };
      if (userId) filter.userId = userId;

      return await this.chatGroupModel.find(filter).exec();
    } catch (error) {
      this.logger.error('Error getting groups:', error);
      throw error;
    }
  }

  async createGroup(groupData: Partial<ChatGroup>): Promise<ChatGroupDocument> {
    try {
      const group = new this.chatGroupModel({
        groupId: uuidv4(),
        ...groupData,
      });

      return await group.save();
    } catch (error) {
      this.logger.error('Error creating group:', error);
      throw error;
    }
  }
}