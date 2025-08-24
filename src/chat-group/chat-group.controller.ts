import { Controller, Get, Post, Body, UseGuards, Request, Query, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ChatGroupService } from './chat-group.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@Controller('groups')
@ApiTags('chat-groups')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
@TenantScope()
export class ChatGroupController {
  constructor(private chatGroupService: ChatGroupService) {}

  @Get()
  @ApiOperation({
    summary: 'Get chat groups',
    description: 'Retrieve all WhatsApp chat groups with optional filtering by user'
  })
  @ApiQuery({
    name: 'userId',
    description: 'Filter groups by specific user ID',
    type: 'string',
    required: false,
    example: '507f1f77bcf86cd799439014'
  })
  @ApiResponse({
    status: 200,
    description: 'Groups retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Groups retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '507f1f77bcf86cd799439016' },
              groupName: { type: 'string', example: 'Project Team Chat' },
              groupId: { type: 'string', example: '120363043211234567@g.us' },
              description: { type: 'string', example: 'Main project discussion group' },
              memberCount: { type: 'number', example: 15 },
              isActive: { type: 'boolean', example: true },
              createdAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
              updatedAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
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
    description: 'Bad Request - Error retrieving groups',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to retrieve groups!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Database connection error' }
      }
    }
  })
  async getGroups(@Req() request, @Res() response, @Query('userId') userId?: string) {
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
      const groups = await this.chatGroupService.getGroups(request.user.tenantId, userId);
      responseData.message = 'Groups retrieved successfully';
      responseData.data = groups;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve groups!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create chat group',
    description: 'Create a new WhatsApp chat group for the tenant'
  })
  @ApiBody({
    description: 'Chat group creation data',
    schema: {
      type: 'object',
      properties: {
        groupName: { type: 'string', example: 'Project Team Chat' },
        description: { type: 'string', example: 'Main project discussion group' },
        groupId: { type: 'string', example: '120363043211234567@g.us' }
      },
      required: ['groupName']
    },
    examples: {
      projectGroup: {
        summary: 'Project group example',
        value: {
          groupName: 'Project Alpha Team',
          description: 'Discussion group for Project Alpha team members',
          groupId: '120363043211234567@g.us'
        }
      },
      supportGroup: {
        summary: 'Support group example',
        value: {
          groupName: 'Customer Support Team',
          description: 'Internal support team coordination',
          groupId: '120363043211234568@g.us'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Group created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Group has been created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439016' },
            groupName: { type: 'string', example: 'Project Alpha Team' },
            groupId: { type: 'string', example: '120363043211234567@g.us' },
            description: { type: 'string', example: 'Discussion group for Project Alpha team members' },
            tenantId: { type: 'string', example: '507f1f77bcf86cd799439017' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439014' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
            updatedAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid group data',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Group not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Group name is required' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Group with this name already exists',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Group not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Group with name "Project Alpha Team" already exists' }
      }
    }
  })
  async createGroup(@Req() request, @Res() response, @Body() createGroupDto: any) {
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
      const groupData = {
        ...createGroupDto,
        tenantId: request.user.tenantId,
        userId: request.user.userId,
      };
      const group = await this.chatGroupService.createGroup(groupData);
      responseData.message = 'Group has been created successfully';
      responseData.data = group;
      return response.status(HttpStatus.CREATED).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Group not created!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}