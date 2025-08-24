import { IsString, IsOptional, IsEmail, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString({ message: 'Contact name must be a string' })
  @IsNotEmpty({ message: 'Contact name is required' })
  @MinLength(1, { message: 'Contact name must be at least 1 character' })
  @MaxLength(100, { message: 'Contact name must be less than 100 characters' })
  contactName: string;

  @IsString({ message: 'Phone number must be a string' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @MinLength(8, { message: 'Phone number must be at least 8 digits' })
  @MaxLength(25, { message: 'Phone number must be less than 25 characters' })
  phoneNumber: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

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
