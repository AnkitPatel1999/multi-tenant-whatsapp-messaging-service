import { IsOptional, IsString } from 'class-validator';

export class GetContactsQueryDto {
	@IsOptional()
	@IsString()
	userId?: string;
}