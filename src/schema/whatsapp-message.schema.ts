import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsAppMessageDocument = WhatsAppMessage & Document;

@Schema({ 
  timestamps: true,
  collection: 'whatsapp_messages'
})
export class WhatsAppMessage {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  messageId: string;

  @Prop({ required: true, index: true })
  chatId: string; // JID of the chat (user or group)

  @Prop({ required: true, index: true })
  fromJid: string; // JID of sender

  @Prop({ index: true })
  toJid?: string; // JID of recipient (for sent messages)

  @Prop({ required: true, enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact', 'other'] })
  messageType: string;

  @Prop()
  textContent?: string;

  @Prop()
  mediaUrl?: string;

  @Prop()
  mediaType?: string;

  @Prop()
  mediaSize?: number;

  @Prop()
  fileName?: string;

  @Prop()
  caption?: string;

  @Prop({ type: Object })
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  @Prop({ type: Object })
  contact?: {
    displayName: string;
    vcard: string;
  };

  @Prop({ required: true, enum: ['incoming', 'outgoing'] })
  direction: string;

  @Prop({ required: true, enum: ['sent', 'delivered', 'read', 'failed', 'pending'] })
  status: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop()
  quotedMessageId?: string; // For replies

  @Prop({ type: Object })
  quotedMessage?: {
    messageId: string;
    content: string;
    sender: string;
  };

  @Prop({ default: false })
  isForwarded: boolean;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: false })
  isStarred: boolean;

  @Prop({ type: Object })
  rawMessage?: any; // Store the complete Baileys message object

  @Prop({ type: [String] })
  mentionedJids?: string[];

  @Prop()
  groupSubject?: string; // For group messages

  @Prop({ default: true })
  isActive: boolean;
}

export const WhatsAppMessageSchema = SchemaFactory.createForClass(WhatsAppMessage);

// Indexes for better query performance
WhatsAppMessageSchema.index({ deviceId: 1, chatId: 1, timestamp: -1 });
WhatsAppMessageSchema.index({ deviceId: 1, messageId: 1 }, { unique: true });
WhatsAppMessageSchema.index({ userId: 1, tenantId: 1, timestamp: -1 });
WhatsAppMessageSchema.index({ chatId: 1, timestamp: -1 });
