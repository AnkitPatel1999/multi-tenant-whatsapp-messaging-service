import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContactDocument = HydratedDocument<Contact>;

@Schema({ timestamps: true })
export class Contact {
  @Prop({ required: true })
  contactId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ required: true })
  contactName: string;

  @Prop()
  email?: string;

  @Prop()
  notes?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

// Indexes for efficient querying
ContactSchema.index({ tenantId: 1, userId: 1, phoneNumber: 1 }, { unique: true });
ContactSchema.index({ tenantId: 1, phoneNumber: 1 });
ContactSchema.index({ tenantId: 1, userId: 1, isActive: 1 });