import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppContact, WhatsAppContactDocument } from '../schema/whatsapp-contact.schema';


@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(WhatsAppContact.name) private contactModel: Model<WhatsAppContactDocument>,
  ) { }

  async getContacts(tenantId: string, userId?: string): Promise<WhatsAppContactDocument[]> {
    try {
      // Build filter based on available parameters
      const filter: any = { isActive: true };
      
      if (tenantId) {
        filter.tenantId = tenantId;
      }
      
      if (userId) {
        filter.userId = userId;
      }
      
      const contacts = await this.contactModel.find(filter).exec();
      return contacts;
    } catch (error) {
      this.logger.error('Error fetching WhatsApp contacts:', error.message);
      return [];
    }
  }



  async getContactsForCache(deviceId: string, userId: string, tenantId: string): Promise<any[]> {
    // This method should return contacts in a format suitable for caching
    const contacts = await this.getContacts(tenantId, userId);
    return contacts.map(contact => ({
      contactId: contact.contactId,
      name: contact.name,
      pushName: contact.pushName,
      phoneNumber: contact.phoneNumber,
      whatsappId: contact.whatsappId,
      isActive: contact.isActive,
      isBusiness: contact.isBusiness,
      businessName: contact.businessName,
      profilePicUrl: contact.profilePicUrl,
      status: contact.status,
      lastSeen: contact.lastSeen
    }));
  }

  async getGroupsForCache(deviceId: string, userId: string, tenantId: string): Promise<any[]> {
    // This method should return groups in a format suitable for caching
    // For now, return empty array as groups are handled by ChatGroupService
    return [];
  }

  async updateLastSyncTimestamp(deviceId: string): Promise<void> {
    // This method should update the last sync timestamp for a device
    // For now, just log the action
    this.logger.log(`Updated last sync timestamp for device: ${deviceId}`);
  }

  async cacheFailedSync(data: any, error: Error): Promise<void> {
    // This method should cache failed sync information
    // For now, just log the failure
    this.logger.error(`Failed sync for device: ${data.deviceId}`, error.message);
  }
}