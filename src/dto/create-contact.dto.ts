import { IsString, IsOptional, IsEmail, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({
    description: 'Contact display name',
    example: 'John Doe',
    minLength: 1,
    maxLength: 100
  })
  @IsString({ message: 'Contact name must be a string' })
  @IsNotEmpty({ message: 'Contact name is required' })
  @MinLength(1, { message: 'Contact name must be at least 1 character' })
  @MaxLength(100, { message: 'Contact name must be less than 100 characters' })
  contactName: string;

  @ApiProperty({
    description: 'Phone number in international format (with country code)',
    example: '+1234567890',
    minLength: 8,
    maxLength: 25,
    pattern: '^[+]?[0-9\\s\\-\\(\\)]{8,25}$'
  })
  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @MinLength(8, { message: 'Phone number must be at least 8 digits' })
  @MaxLength(25, { message: 'Phone number must be less than 25 characters' })
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'Optional email address for the contact',
    example: 'john.doe@example.com',
    format: 'email'
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the contact',
    example: 'Important client - prefers WhatsApp communication',
    maxLength: 500
  })
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(500, { message: 'Notes must be less than 500 characters' })
  notes?: string;
}

export class CreateContactData extends CreateContactDto {
  contactId: string;
  tenantId: string;
  userId: string;
  isActive: boolean;
}
