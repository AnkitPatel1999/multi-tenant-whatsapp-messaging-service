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
    const filter: any = { tenantId, isActive: true };
    if (userId) filter.userId = userId;

    return await this.chatGroupModel.find(filter).exec();
  }

  async createGroup(groupData: Partial<ChatGroup>): Promise<ChatGroupDocument> {
    const group = new this.chatGroupModel({
      groupId: uuidv4(),
      ...groupData,
    });

    return await group.save();
  }

  async getGroupsForCache(deviceId: string, userId: string, tenantId: string): Promise<any[]> {
    // This method should return groups in a format suitable for caching
    const groups = await this.getGroups(tenantId, userId);
    return groups.map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      description: group.description,
      isActive: group.isActive,
    }));
  }
}