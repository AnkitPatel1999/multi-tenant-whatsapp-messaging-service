import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
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
  async getGroups(@Request() req, @Query('userId') userId?: string) {
    return this.chatGroupService.getGroups(req.user.tenantId, userId);
  }

  @Post()
  async createGroup(@Request() req, @Body() createGroupDto: any) {
    return this.chatGroupService.createGroup({
      ...createGroupDto,
      tenantId: req.user.tenantId,
      userId: req.user.userId,
    });
  }
}