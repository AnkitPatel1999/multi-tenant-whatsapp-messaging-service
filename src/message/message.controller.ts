import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
@TenantScope()
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get()
  async getMessages(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('groupId') groupId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.messageService.getMessages(
      req.user.tenantId,
      userId,
      groupId,
      limit || 50
    );
  }
}
