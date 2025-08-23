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
  ) {}

  async getContacts(tenantId: string, userId?: string): Promise<ContactDocument[]> {
    try {
      const filter: any = { tenantId, isActive: true };
      if (userId) filter.userId = userId;

      return await this.contactModel.find(filter).exec();
    } catch (error) {
      this.logger.error('Error getting contacts:', error);
      throw error;
    }
  }

  async createContact(contactData: Partial<Contact>): Promise<ContactDocument> {
    try {
      const contact = new this.contactModel({
        contactId: uuidv4(),
        ...contactData,
      });

      return await contact.save();
    } catch (error) {
      this.logger.error('Error creating contact:', error);
      throw error;
    }
  }
}