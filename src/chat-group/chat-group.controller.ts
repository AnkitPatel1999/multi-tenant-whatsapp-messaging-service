import { Controller, Get, Post, Body, UseGuards, Request, Query, Res, Req, HttpStatus } from '@nestjs/common';
import { ChatGroupService } from './chat-group.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
@TenantScope()
export class ChatGroupController {
  constructor(private chatGroupService: ChatGroupService) {}

  @Get()
  async getGroups(@Req() request, @Res() response, @Query('userId') userId?: string) {
    try {
      const groups = await this.chatGroupService.getGroups(request.user.tenantId, userId);
      return response.status(HttpStatus.OK).json({
        message: 'Groups retrieved successfully',
        groups
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to retrieve groups!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Post()
  async createGroup(@Req() request, @Res() response, @Body() createGroupDto: any) {
    try {
      const groupData = {
        ...createGroupDto,
        tenantId: request.user.tenantId,
        userId: request.user.userId,
      };
      const group = await this.chatGroupService.createGroup(groupData);
      return response.status(HttpStatus.CREATED).json({
        message: 'Group has been created successfully',
        group
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Group not created!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }
}