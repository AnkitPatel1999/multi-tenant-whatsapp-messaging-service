import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  groupId: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  email?: string;

  @Prop()
  phoneNumber?: string;

  @Prop({ default: false })
  isAdmin: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for efficient querying
UserSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, groupId: 1 });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, isActive: 1 });