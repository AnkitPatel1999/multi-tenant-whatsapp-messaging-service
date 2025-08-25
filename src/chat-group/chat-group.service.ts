import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppGroup, WhatsAppGroupDocument } from '../schema/whatsapp-group.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatGroupService {
  private readonly logger = new Logger(ChatGroupService.name);

  constructor(
    @InjectModel(WhatsAppGroup.name) private groupModel: Model<WhatsAppGroupDocument>,
  ) {}

  async getGroups(tenantId: string, userId?: string): Promise<WhatsAppGroupDocument[]> {
    try {
      // Build filter based on available parameters
      const filter: any = { isActive: true };
      
      if (tenantId) {
        filter.tenantId = tenantId;
      }
      
      if (userId) {
        filter.userId = userId;
      }
      
      const groups = await this.groupModel.find(filter).exec();
      return groups;
    } catch (error) {
      this.logger.error('Error fetching WhatsApp groups:', error.message);
      return [];
    }
  }

  async createGroup(groupData: Partial<WhatsAppGroup>): Promise<WhatsAppGroupDocument> {
    const group = new this.groupModel({
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
      name: group.name,
      description: group.description,
      whatsappGroupId: group.whatsappGroupId,
      participantCount: group.participantCount,
      isActive: group.isActive,
      isAnnouncement: group.isAnnouncement,
      isRestricted: group.isRestricted,
      profilePicUrl: group.profilePicUrl,
      ownerJid: group.ownerJid,
      participants: group.participants
    }));
  }
}