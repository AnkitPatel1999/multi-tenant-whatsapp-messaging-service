import { IsString, IsOptional, IsEnum, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeviceDto {
  @ApiProperty({
    description: 'Name for the WhatsApp device',
    example: 'My Business WhatsApp',
    minLength: 1,
    maxLength: 100
  })
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
  @ApiProperty({
    description: 'ID of the WhatsApp device to send message from',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({
    description: 'Recipient phone number or group ID in WhatsApp format',
    example: '1234567890@c.us',
    pattern: '^[0-9]+@[csg]\\.us$'
  })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({
    description: 'Message content to send',
    example: 'Hello! This is a test message from our API.',
    maxLength: 4096
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Type of message to send',
    enum: ['text', 'media'],
    example: 'text',
    default: 'text'
  })
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