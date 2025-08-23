import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WhatsAppDeviceDocument = HydratedDocument<WhatsAppDevice>;

@Schema({ timestamps: true })
export class WhatsAppDevice {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  deviceName: string;

  @Prop()
  sessionData?: string;

  @Prop()
  authState?: string; // Baileys auth state

  @Prop({ default: false })
  isConnected: boolean;

  @Prop()
  lastConnectedAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  phoneNumber?: string;

  @Prop()
  qrCode?: string;

  @Prop()
  qrExpiry?: Date;
}

export const WhatsAppDeviceSchema = SchemaFactory.createForClass(WhatsAppDevice);

// Indexes for efficient querying
WhatsAppDeviceSchema.index({ tenantId: 1, userId: 1, deviceId: 1 }, { unique: true });
WhatsAppDeviceSchema.index({ tenantId: 1, isConnected: 1 });
WhatsAppDeviceSchema.index({ userId: 1, isActive: 1 });