import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEmail, IsPhoneNumber, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Username for the new user account',
    example: 'john.smith',
    minLength: 3,
    maxLength: 50
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @ApiProperty({
    description: 'Password for the user account',
    example: 'admin123',
    minLength: 8,
    format: 'password'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Group ID to assign the user to',
    example: '507f1f77bcf86cd799439011',
    format: 'uuid'
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID(4, { message: 'Group ID must be a valid UUID' })
  groupId: string;

  @ApiPropertyOptional({
    description: 'Email address of the user',
    example: 'john.smith@example.com',
    format: 'email'
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number in international format',
    example: '+1234567890'
  })
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'Phone number must be valid' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Whether the user has admin privileges',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @ApiPropertyOptional({
    description: 'Full name of the user',
    example: 'John Smith'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Whether the user account is active',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Interface for internal use in service (includes tenantId)
export interface CreateUserData extends CreateUserDto {
  tenantId: string;
}
