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
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string | null;
    } = {
      message: 'Something went wrong!',
      data: {},
      error: 0,
      confidentialErrorMessage: null
    }
    try {
      const messages = await this.messageService.getMessages(
        request.user.tenantId,
        userId,
        groupId,
        limit || 50
      );
      responseData.message = 'Messages retrieved successfully';
      responseData.data = messages;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve messages!';
      responseData.confidentialErrorMessage = err.message;
      delete responseData.confidentialErrorMessage;
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}
