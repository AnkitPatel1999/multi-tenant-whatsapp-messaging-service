import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WhatsAppContactDocument = HydratedDocument<WhatsAppContact>;

@Schema({ timestamps: true })
export class WhatsAppContact {
  @Prop({ required: true })
  contactId: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  whatsappId: string; // WhatsApp JID (e.g., 919712448793@s.whatsapp.net)

  @Prop()
  name: string;

  @Prop()
  pushName: string;

  @Prop()
  profilePicUrl: string;

  @Prop()
  status: string; // WhatsApp status message

  @Prop()
  phoneNumber: string;

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: false })
  isBusiness: boolean;

  @Prop()
  businessName: string;

  @Prop({ type: Object })
  metadata: any; // Additional WhatsApp metadata

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastSeen: Date;

  @Prop()
  lastSyncedAt: Date;
}

export const WhatsAppContactSchema = SchemaFactory.createForClass(WhatsAppContact);

// Indexes for efficient querying
WhatsAppContactSchema.index({ deviceId: 1, whatsappId: 1 }, { unique: true });
WhatsAppContactSchema.index({ userId: 1, tenantId: 1 });
WhatsAppContactSchema.index({ phoneNumber: 1 });
WhatsAppContactSchema.index({ deviceId: 1, isActive: 1 });
