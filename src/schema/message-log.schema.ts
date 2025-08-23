import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageLogDocument = HydratedDocument<MessageLog>;

@Schema({ timestamps: true })
export class MessageLog {
  @Prop({ required: true })
  messageId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  recipientPhoneNumber: string;

  @Prop()
  groupId?: string;

  @Prop({ required: true })
  messageContent: string;

  @Prop({ required: true })
  messageType: 'text' | 'media' | 'document';

  @Prop({ required: true })
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

  @Prop({ required: true })
  timestamp: Date;

  @Prop()
  mediaUrl?: string;

  @Prop()
  errorMessage?: string;

  @Prop()
  baileysMessageId?: string;
}

export const MessageLogSchema = SchemaFactory.createForClass(MessageLog);

// Indexes for efficient querying
MessageLogSchema.index({ tenantId: 1, timestamp: -1 });
MessageLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
MessageLogSchema.index({ tenantId: 1, groupId: 1, timestamp: -1 });
MessageLogSchema.index({ tenantId: 1, status: 1, timestamp: -1 });
MessageLogSchema.index({ messageId: 1 }, { unique: true });