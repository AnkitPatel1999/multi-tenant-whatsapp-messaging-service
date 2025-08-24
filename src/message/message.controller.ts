import { Controller, Get, Query, UseGuards, Request, Res, Req, HttpStatus } from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { PermissionGuard, RequirePermissions } from '../auth/guards/permission.guard';
import { PERMISSIONS } from '../auth/constants/permissions';
import { GetMessagesQueryDto } from '../dto/get-messages-query.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getMessages(
    @Req() request,
    @Res() response,
    @Query() query: GetMessagesQueryDto,
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
        query.userId,
        query.groupId,
        query.limit || 50
      );
      responseData.message = 'Messages retrieved successfully';
      responseData.data = messages;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve messages!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}
