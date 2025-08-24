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
   * Note: Baileys doesn't have a getContacts() method. We need to access contacts through the store.
   */
  async syncContacts(deviceId: string, connection: any): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    console.log('🔄 [CONTACT SYNC] Starting contact synchronization:', {
      deviceId,
      timestamp: new Date().toISOString()
    });

    try {
      this.logger.log(`Starting contact sync for device ${deviceId}`);

      // Get device info
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (!device) {
        console.error('❌ [CONTACT SYNC] FAILED - Device not found:', { deviceId });
        throw new NotFoundException('Device not found');
      }

      console.log('📋 [CONTACT SYNC] Device found, accessing contacts from store...', {
        deviceId,
        userId: device.userId,
        tenantId: device.tenantId
      });

      // Try to access contacts through different methods available in Baileys
      let contacts = {};
      
      // Method 1: Try to access through store if available
      if (connection.store && connection.store.contacts) {
        contacts = connection.store.contacts;
        console.log('📞 [CONTACT SYNC] Using connection.store.contacts');
      }
      // Method 2: Try to access through authState if available
      else if (connection.authState && connection.authState.contacts) {
        contacts = connection.authState.contacts;
        console.log('📞 [CONTACT SYNC] Using connection.authState.contacts');
      }
      // Method 3: Check if contacts are accessible directly
      else if (connection.contacts) {
        contacts = connection.contacts;
        console.log('📞 [CONTACT SYNC] Using connection.contacts');
      }
      else {
        console.log('⚠️ [CONTACT SYNC] No contacts available through connection properties. Will rely on event-driven contact syncing from contacts.upsert events.');
        
        // Update device sync timestamp anyway
        await this.deviceModel.updateOne(
          { deviceId },
          { lastContactSync: new Date() }
        );
        
        console.log('ℹ️ [CONTACT SYNC] Event-driven contact sync enabled. Contacts will be automatically synced when contacts.upsert events are received.');
        
        return { synced: 0, errors: 0 };
      }

      const contactCount = Object.keys(contacts).length;
      
      console.log('📞 [CONTACT SYNC] Contacts found in WhatsApp store:', {
        deviceId,
        contactCount,
        contactJids: Object.keys(contacts).slice(0, 10) // Show first 10 JIDs
      });

      this.logger.log(`Found ${contactCount} contacts in WhatsApp store`);

      // Process each contact
      for (const [jid, contact] of Object.entries(contacts)) {
        try {
          console.log('🔄 [CONTACT SYNC] Processing contact:', {
            jid,
            name: (contact as any).name || (contact as any).notify || (contact as any).verifiedName,
            phoneNumber: this.extractPhoneNumber(jid)
          });
          
          await this.saveContactInternal(deviceId, device.userId, device.tenantId, jid, contact as any);
          synced++;
          
          console.log('✅ [CONTACT SYNC] Contact saved successfully:', {
            jid,
            name: (contact as any).name || (contact as any).notify,
            syncedCount: synced
          });
        } catch (error) {
          console.error('❌ [CONTACT SYNC] Failed to save contact:', {
            jid,
            error: error.message,
            errorCount: errors + 1
          });
          this.logger.error(`Error syncing contact ${jid}:`, error.message);
          errors++;
        }
      }

      // Update device sync timestamp
      await this.deviceModel.updateOne(
        { deviceId },
        { lastContactSync: new Date() }
      );

      console.log('✅ [CONTACT SYNC] Contact synchronization completed:', {
        deviceId,
        synced,
        errors,
        total: contactCount,
        successRate: contactCount > 0 ? ((synced / contactCount) * 100).toFixed(2) + '%' : '0%',
        completedAt: new Date().toISOString()
      });

      this.logger.log(`Contact sync completed for device ${deviceId}. Synced: ${synced}, Errors: ${errors}`);
      return { synced, errors };

    } catch (error) {
      console.error('❌ [CONTACT SYNC] Contact synchronization failed:', {
        deviceId,
        error: error.message,
        synced,
        errors,
        stack: error.stack
      });
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

    console.log('🔄 [GROUP SYNC] Starting group synchronization:', {
      deviceId,
      timestamp: new Date().toISOString()
    });

    try {
      this.logger.log(`Starting group sync for device ${deviceId}`);

      // Get device info
      const device = await this.deviceModel.findOne({ deviceId }).exec();
      if (!device) {
        console.error('❌ [GROUP SYNC] FAILED - Device not found:', { deviceId });
        throw new NotFoundException('Device not found');
      }

      console.log('📋 [GROUP SYNC] Device found, fetching groups from WhatsApp...', {
        deviceId,
        userId: device.userId,
        tenantId: device.tenantId
      });

      // Fetch groups from WhatsApp
      const groups = await connection.groupFetchAllParticipating();
      const groupCount = Object.keys(groups).length;
      
      console.log('👥 [GROUP SYNC] Groups fetched from WhatsApp:', {
        deviceId,
        groupCount,
        groupJids: Object.keys(groups).slice(0, 5) // Show first 5 group JIDs
      });

      this.logger.log(`Fetched ${groupCount} groups from WhatsApp`);

      // Process each group
      for (const [groupJid, groupInfo] of Object.entries(groups)) {
        try {
          const group = groupInfo as any;
          console.log('🔄 [GROUP SYNC] Processing group:', {
            groupJid,
            subject: group.subject || 'Unknown Group',
            participantCount: group.participants?.length || 0,
            owner: group.owner
          });
          
          await this.saveGroup(deviceId, device.userId, device.tenantId, groupJid, group);
          synced++;
          
          console.log('✅ [GROUP SYNC] Group saved successfully:', {
            groupJid,
            subject: group.subject || 'Unknown Group',
            participantCount: group.participants?.length || 0,
            syncedCount: synced
          });
        } catch (error) {
          console.error('❌ [GROUP SYNC] Failed to save group:', {
            groupJid,
            error: error.message,
            errorCount: errors + 1
          });
          this.logger.error(`Error syncing group ${groupJid}:`, error.message);
          errors++;
        }
      }

      // Update device sync timestamp
      await this.deviceModel.updateOne(
        { deviceId },
        { lastGroupSync: new Date() }
      );

      console.log('✅ [GROUP SYNC] Group synchronization completed:', {
        deviceId,
        synced,
        errors,
        total: groupCount,
        successRate: groupCount > 0 ? ((synced / groupCount) * 100).toFixed(2) + '%' : '0%',
        completedAt: new Date().toISOString()
      });

      this.logger.log(`Group sync completed for device ${deviceId}. Synced: ${synced}, Errors: ${errors}`);
      return { synced, errors };

    } catch (error) {
      console.error('❌ [GROUP SYNC] Group synchronization failed:', {
        deviceId,
        error: error.message,
        synced,
        errors,
        stack: error.stack
      });
      this.logger.error(`Group sync failed for device ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Public method to save a single contact (used by store events)
   */
  async saveContact(deviceId: string, userId: string, tenantId: string, jid: string, contact: any): Promise<void> {
    return this.saveContactInternal(deviceId, userId, tenantId, jid, contact);
  }

  /**
   * Save or update a contact in database
   */
  private async saveContactInternal(deviceId: string, userId: string, tenantId: string, jid: string, contact: any): Promise<void> {
    console.log('🔄 [CONTACT DB] Attempting to save contact to database:', {
      jid,
      deviceId,
      name: contact.name || contact.notify || contact.verifiedName,
      phoneNumber: this.extractPhoneNumber(jid)
    });

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

      const savedContact = await this.contactModel.findOneAndUpdate(
        { deviceId, whatsappId: jid },
        contactData,
        { upsert: true, new: true }
      );

      console.log('✅ [CONTACT DB] SUCCESS - Contact saved to database:', {
        jid,
        deviceId,
        name: contactData.name,
        phoneNumber,
        dbId: savedContact._id,
        upserted: true
      });

      this.logger.debug(`Saved contact: ${contact.name || phoneNumber}`);
    } catch (error) {
      console.error('❌ [CONTACT DB] FAILED - Error saving contact to database:', {
        jid,
        deviceId,
        error: error.message,
        stack: error.stack
      });
      this.logger.error(`Error saving contact ${jid}:`, error.message);
      throw error;
    }
  }

  /**
   * Save or update a group in database
   */
  private async saveGroup(deviceId: string, userId: string, tenantId: string, groupJid: string, groupInfo: any): Promise<void> {
    console.log('🔄 [GROUP DB] Attempting to save group to database:', {
      groupJid,
      deviceId,
      subject: groupInfo.subject || 'Unknown Group',
      participantCount: groupInfo.participants?.length || 0
    });

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

      const savedGroup = await this.groupModel.findOneAndUpdate(
        { deviceId, whatsappGroupId: groupJid },
        groupData,
        { upsert: true, new: true }
      );

      console.log('✅ [GROUP DB] SUCCESS - Group saved to database:', {
        groupJid,
        deviceId,
        subject: groupData.name,
        participantCount: participants.length,
        dbId: savedGroup._id,
        upserted: true,
        participants: participants.slice(0, 5).map(p => ({ id: p.id, name: p.name }))
      });

      this.logger.debug(`Saved group: ${groupInfo.subject} (${participants.length} participants)`);
    } catch (error) {
      console.error('❌ [GROUP DB] FAILED - Error saving group to database:', {
        groupJid,
        deviceId,
        subject: groupInfo.subject,
        error: error.message,
        stack: error.stack
      });
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
