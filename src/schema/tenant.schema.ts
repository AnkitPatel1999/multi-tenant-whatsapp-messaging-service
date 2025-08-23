import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true, unique: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed })
  settings?: Record<string, any>;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

// Indexes for efficient querying
TenantSchema.index({ tenantId: 1 }, { unique: true });
TenantSchema.index({ isActive: 1 });