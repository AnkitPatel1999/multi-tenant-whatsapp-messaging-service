import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceName: string;
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
  type?: 'text' | 'media' = 'text';
}

export class GenerateQRDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
