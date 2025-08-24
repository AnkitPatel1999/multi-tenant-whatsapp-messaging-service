import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WhatsAppGroupDocument = HydratedDocument<WhatsAppGroup>;

export interface GroupParticipant {
  id: string; // WhatsApp JID
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name?: string;
  phoneNumber?: string;
}

@Schema({ timestamps: true })
export class WhatsAppGroup {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  whatsappGroupId: string; // WhatsApp Group JID

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  profilePicUrl: string;

  @Prop()
  ownerJid: string; // Group owner's WhatsApp JID

  @Prop({ type: [Object], default: [] })
  participants: GroupParticipant[];

  @Prop({ default: 0 })
  participantCount: number;

  @Prop({ default: false })
  isAnnouncement: boolean; // Only admins can send messages

  @Prop({ default: false })
  isRestricted: boolean; // Only admins can edit group info

  @Prop()
  createdAt: Date;

  @Prop({ type: Object })
  metadata: any; // Additional WhatsApp group metadata

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastSyncedAt: Date;
}

export const WhatsAppGroupSchema = SchemaFactory.createForClass(WhatsAppGroup);

// Indexes for efficient querying
WhatsAppGroupSchema.index({ deviceId: 1, whatsappGroupId: 1 }, { unique: true });
WhatsAppGroupSchema.index({ userId: 1, tenantId: 1 });
WhatsAppGroupSchema.index({ deviceId: 1, isActive: 1 });
WhatsAppGroupSchema.index({ 'participants.id': 1 });
