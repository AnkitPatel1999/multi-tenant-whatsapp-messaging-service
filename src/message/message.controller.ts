import { Controller, Get, Query, UseGuards, Request, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@Controller('messages')
@ApiTags('messages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
@TenantScope()
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get()
  @ApiOperation({
    summary: 'Get messages',
    description: 'Retrieve messages with optional filtering by user, group, and pagination'
  })
  @ApiQuery({
    name: 'userId',
    description: 'Filter messages by specific user ID',
    type: 'string',
    required: false,
    example: '507f1f77bcf86cd799439014'
  })
  @ApiQuery({
    name: 'groupId',
    description: 'Filter messages by specific group ID',
    type: 'string',
    required: false,
    example: '507f1f77bcf86cd799439015'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of messages to return',
    type: 'number',
    required: false,
    example: 50
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Messages retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'MSG123' },
              content: { type: 'string', example: 'Hello, how are you?' },
              from: { type: 'string', example: '1234567890@c.us' },
              to: { type: 'string', example: '0987654321@c.us' },
              timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
              type: { type: 'string', example: 'text' },
              direction: { type: 'string', enum: ['incoming', 'outgoing'], example: 'outgoing' },
              userId: { type: 'string', example: '507f1f77bcf86cd799439014' },
              groupId: { type: 'string', example: '507f1f77bcf86cd799439015' }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to retrieve messages!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Invalid limit parameter' }
      }
    }
  })
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
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}
