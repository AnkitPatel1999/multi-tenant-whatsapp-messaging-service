import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatGroupDocument = HydratedDocument<ChatGroup>;

@Schema({ timestamps: true })
export class ChatGroup {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  groupName: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], required: true })
  participants: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  groupImage?: string;

  @Prop()
  whatsappGroupId?: string;
}

export const ChatGroupSchema = SchemaFactory.createForClass(ChatGroup);

// Indexes for efficient querying
ChatGroupSchema.index({ tenantId: 1, groupId: 1 }, { unique: true });
ChatGroupSchema.index({ tenantId: 1, userId: 1, isActive: 1 });
ChatGroupSchema.index({ tenantId: 1, participants: 1 });