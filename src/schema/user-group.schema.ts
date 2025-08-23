import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserGroupDocument = HydratedDocument<UserGroup>;

@Schema({ timestamps: true })
export class UserGroup {
  @Prop({ required: true })
  groupId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const UserGroupSchema = SchemaFactory.createForClass(UserGroup);

// Indexes for efficient querying
UserGroupSchema.index({ tenantId: 1, groupId: 1 }, { unique: true });
UserGroupSchema.index({ tenantId: 1, isActive: 1 });