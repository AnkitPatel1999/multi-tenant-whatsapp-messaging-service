import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignUserToGroupDto {
	@IsString()
	@IsNotEmpty()
	@IsUUID()
	groupId: string;
}