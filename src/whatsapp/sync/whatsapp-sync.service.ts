import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppContact, WhatsAppContactDocument } from '../../schema/whatsapp-contact.schema';
import { WhatsAppGroup, WhatsAppGroupDocument, GroupParticipant } from '../../schema/whatsapp-group.schema';
import { WhatsAppDevice, WhatsAppDeviceDocument } from '../../schema/whatsapp-device.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WhatsAppSyncService {
  private readonly logger = new Logger(WhatsAppSyncService.name);

  constructor(
    @InjectModel(WhatsAppContact.name) private contactModel: Model<WhatsAppContactDocument>,
    @InjectModel(WhatsAppGroup.name) private groupModel: Model<WhatsAppGroupDocument>,
    @InjectModel(WhatsAppDevice.name) private deviceModel: Model<WhatsAppDeviceDocument>,
  ) {}

  /**
   * Sync contacts from WhatsApp to database
   */
  async syncContacts(deviceId: string, connection: any): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      this.logger.log(`Starting contact sync for device ${deviceId}`);

      // Get device info
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }

      // Fetch contacts from WhatsApp
      const contacts = await connection.getContacts();
      this.logger.log(`Fetched ${Object.keys(contacts).length} contacts from WhatsApp`);

      // Process each contact
      for (const [jid, contact] of Object.entries(contacts)) {
        try {
          await this.saveContact(deviceId, device.userId, device.tenantId, jid, contact as any);
          synced++;
        } catch (error) {
          this.logger.error(`Error syncing contact ${jid}:`, error.message);
          errors++;
        }
      }

      // Update device sync timestamp
      await this.deviceModel.updateOne(
        { deviceId },
        { lastContactSync: new Date() }
      );

      this.logger.log(`Contact sync completed for device ${deviceId}. Synced: ${synced}, Errors: ${errors}`);
      return { synced, errors };

    } catch (error) {
      this.logger.error(`Contact sync failed for device ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync groups from WhatsApp to database
   */
  async syncGroups(deviceId: string, connection: any): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      this.logger.log(`Starting group sync for device ${deviceId}`);

      // Get device info
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (!device) {
        throw new NotFoundException('Device not found');
      }

      // Fetch groups from WhatsApp
      const groups = await connection.groupFetchAllParticipating();
      this.logger.log(`Fetched ${Object.keys(groups).length} groups from WhatsApp`);

      // Process each group
      for (const [groupJid, groupInfo] of Object.entries(groups)) {
        try {
          await this.saveGroup(deviceId, device.userId, device.tenantId, groupJid, groupInfo as any);
          synced++;
        } catch (error) {
          this.logger.error(`Error syncing group ${groupJid}:`, error.message);
          errors++;
        }
      }

      // Update device sync timestamp
      await this.deviceModel.updateOne(
        { deviceId },
        { lastGroupSync: new Date() }
      );

      this.logger.log(`Group sync completed for device ${deviceId}. Synced: ${synced}, Errors: ${errors}`);
      return { synced, errors };

    } catch (error) {
      this.logger.error(`Group sync failed for device ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Save or update a contact in database
   */
  private async saveContact(deviceId: string, userId: string, tenantId: string, jid: string, contact: any): Promise<void> {
    try {
      const phoneNumber = this.extractPhoneNumber(jid);
      
      const contactData = {
        contactId: uuidv4(),
        deviceId,
        userId,
        tenantId,
        whatsappId: jid,
        name: contact.name || contact.notify || contact.verifiedName,
        pushName: contact.notify,
        profilePicUrl: contact.imgUrl,
        status: contact.status,
        phoneNumber,
        isBlocked: contact.isBlocked || false,
        isBusiness: contact.isBusiness || false,
        businessName: contact.businessName,
        metadata: {
          verifiedName: contact.verifiedName,
          short: contact.short,
          isMe: contact.isMe,
          isMyContact: contact.isMyContact,
          isWAContact: contact.isWAContact
        },
        isActive: true,
        lastSeen: contact.lastSeen ? new Date(contact.lastSeen * 1000) : undefined,
        lastSyncedAt: new Date()
      };

      await this.contactModel.findOneAndUpdate(
        { deviceId, whatsappId: jid },
        contactData,
        { upsert: true, new: true }
      );

      this.logger.debug(`Saved contact: ${contact.name || phoneNumber}`);
    } catch (error) {
      this.logger.error(`Error saving contact ${jid}:`, error.message);
      throw error;
    }
  }

  /**
   * Save or update a group in database
   */
  private async saveGroup(deviceId: string, userId: string, tenantId: string, groupJid: string, groupInfo: any): Promise<void> {
    try {
      const participants: GroupParticipant[] = groupInfo.participants?.map((p: any) => ({
        id: p.id,
        isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
        isSuperAdmin: p.admin === 'superadmin',
        name: p.name,
        phoneNumber: this.extractPhoneNumber(p.id)
      })) || [];

      const groupData = {
        groupId: uuidv4(),
        deviceId,
        userId,
        tenantId,
        whatsappGroupId: groupJid,
        name: groupInfo.subject || 'Unknown Group',
        description: groupInfo.desc,
        profilePicUrl: groupInfo.pictureUrl,
        ownerJid: groupInfo.owner,
        participants,
        participantCount: participants.length,
        isAnnouncement: groupInfo.announce || false,
        isRestricted: groupInfo.restrict || false,
        createdAt: groupInfo.creation ? new Date(groupInfo.creation * 1000) : new Date(),
        metadata: {
          subjectTime: groupInfo.subjectTime,
          subjectOwner: groupInfo.subjectOwner,
          descTime: groupInfo.descTime,
          descOwner: groupInfo.descOwner,
          size: groupInfo.size
        },
        isActive: true,
        lastSyncedAt: new Date()
      };

      await this.groupModel.findOneAndUpdate(
        { deviceId, whatsappGroupId: groupJid },
        groupData,
        { upsert: true, new: true }
      );

      this.logger.debug(`Saved group: ${groupInfo.subject} (${participants.length} participants)`);
    } catch (error) {
      this.logger.error(`Error saving group ${groupJid}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract phone number from WhatsApp JID
   */
  private extractPhoneNumber(jid: string): string {
    if (!jid) return '';
    
    // Extract number from JID (e.g., 919712448793@s.whatsapp.net -> 919712448793)
    const match = jid.match(/^(\d+)@/);
    return match ? match[1] : '';
  }

  /**
   * Get contacts for a device
   */
  async getContacts(deviceId: string, userId: string, tenantId: string): Promise<WhatsAppContactDocument[]> {
    return this.contactModel.find({
      deviceId,
      userId,
      tenantId,
      isActive: true
    }).sort({ name: 1 }).exec();
  }

  /**
   * Get groups for a device
   */
  async getGroups(deviceId: string, userId: string, tenantId: string): Promise<WhatsAppGroupDocument[]> {
    return this.groupModel.find({
      deviceId,
      userId,
      tenantId,
      isActive: true
    }).sort({ name: 1 }).exec();
  }

  /**
   * Search contacts by name or phone number
   */
  async searchContacts(deviceId: string, userId: string, tenantId: string, query: string): Promise<WhatsAppContactDocument[]> {
    const searchRegex = new RegExp(query, 'i');
    
    return this.contactModel.find({
      deviceId,
      userId,
      tenantId,
      isActive: true,
      $or: [
        { name: searchRegex },
        { pushName: searchRegex },
        { phoneNumber: searchRegex }
      ]
    }).sort({ name: 1 }).exec();
  }

  /**
   * Search groups by name
   */
  async searchGroups(deviceId: string, userId: string, tenantId: string, query: string): Promise<WhatsAppGroupDocument[]> {
    const searchRegex = new RegExp(query, 'i');
    
    return this.groupModel.find({
      deviceId,
      userId,
      tenantId,
      isActive: true,
      $or: [
        { name: searchRegex },
        { description: searchRegex }
      ]
    }).sort({ name: 1 }).exec();
  }

  /**
   * Get sync statistics for a device
   */
  async getSyncStats(deviceId: string): Promise<any> {
    const [contactCount, groupCount, device] = await Promise.all([
      this.contactModel.countDocuments({ deviceId, isActive: true }),
      this.groupModel.countDocuments({ deviceId, isActive: true }),
      this.deviceModel.findOne({ deviceId }).exec()
    ]);

    return {
      deviceId,
      contacts: contactCount,
      groups: groupCount,
      lastContactSync: device?.lastContactSync,
      lastGroupSync: device?.lastGroupSync
    };
  }
}
