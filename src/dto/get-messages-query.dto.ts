import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesQueryDto {
	@IsOptional()
	@IsString()
	userId?: string;

	@IsOptional()
	@IsString()
	groupId?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(500)
	limit?: number;
}