import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact, ContactDocument } from '../schema/contact.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
  ) { }

  async getContacts(tenantId: string, userId?: string): Promise<ContactDocument[]> {
    const filter: any = { tenantId, isActive: true };
    if (userId) filter.userId = userId;

    return await this.contactModel.find(filter).exec();
  }

  async createContact(contactData: Partial<Contact>): Promise<ContactDocument> {
    console.log('createContact service called');
    const contact = new this.contactModel({
      contactId: uuidv4(),
      ...contactData,
    });

    return await contact.save();
  }

  async getContactsForCache(deviceId: string, userId: string, tenantId: string): Promise<any[]> {
    // This method should return contacts in a format suitable for caching
    // For now, return basic contact info
    const contacts = await this.getContacts(tenantId, userId);
    return contacts.map(contact => ({
      contactId: contact.contactId,
      contactName: contact.contactName,
      phoneNumber: contact.phoneNumber,
      email: contact.email,
      isActive: contact.isActive,
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