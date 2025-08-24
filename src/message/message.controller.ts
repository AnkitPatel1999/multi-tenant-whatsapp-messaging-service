import { Controller, Get, Query, UseGuards, Request, Res, Req, HttpStatus } from '@nestjs/common';
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
    @Req() request,
    @Res() response,
    @Query('userId') userId?: string,
    @Query('groupId') groupId?: string,
    @Query('limit') limit?: number,
  ) {
    try {
      const messages = await this.messageService.getMessages(
        request.user.tenantId,
        userId,
        groupId,
        limit || 50
      );
      return response.status(HttpStatus.OK).json({
        message: 'Messages retrieved successfully',
        messages
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to retrieve messages!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }
}
