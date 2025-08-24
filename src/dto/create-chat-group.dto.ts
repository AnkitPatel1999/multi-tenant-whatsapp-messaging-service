import { IsArray, ArrayNotEmpty, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateChatGroupDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	groupName: string;

	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;

	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	participants: string[];
}