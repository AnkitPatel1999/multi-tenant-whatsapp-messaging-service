import { IsString, IsOptional, IsEnum, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  deviceName: string;
}

export class CreateDeviceData extends CreateDeviceDto {
  userId: string;
  tenantId: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsEnum(['text', 'media'])
  type?: 'text' | 'media';
}

export class SendMessageData extends SendMessageDto {
  userId: string;
  tenantId: string;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

export class GenerateQRDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class DisconnectDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export interface WhatsAppConnectionStatus {
  deviceId: string;
  isConnected: boolean;
  deviceInfo: any;
  hasQR: boolean;
}

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  timestamp: Date;
}

export interface WhatsAppConnectionResult {
  success: boolean;
  deviceId: string;
}

export interface WhatsAppQRResult {
  deviceId: string;
  qrCode?: string;
  qrExpiry?: Date;
  isConnected: boolean;
}