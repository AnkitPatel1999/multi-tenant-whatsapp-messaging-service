import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WhatsAppSessionDocument = HydratedDocument<WhatsAppSession>;

@Schema({ timestamps: true })
export class WhatsAppSession {
  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  keyType: string; // 'creds' or 'keys'

  @Prop({ required: true })
  keyId: string; // credential ID or key identifier

  @Prop({ required: true, type: String })
  encryptedData: string; // Encrypted session data

  @Prop({ required: true })
  iv: string; // Initialization vector for encryption

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastAccessed: Date;
}

export const WhatsAppSessionSchema = SchemaFactory.createForClass(WhatsAppSession);

// Indexes for efficient querying
WhatsAppSessionSchema.index({ deviceId: 1, keyType: 1, keyId: 1 }, { unique: true });
WhatsAppSessionSchema.index({ userId: 1, tenantId: 1 });
WhatsAppSessionSchema.index({ deviceId: 1, isActive: 1 });
