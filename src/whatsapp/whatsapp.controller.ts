import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, Req, HttpStatus, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppMessageService } from './message/whatsapp-message.service';
import { BaileysService } from './baileys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { PermissionGuard, RequirePermissions } from '../auth/guards/permission.guard';
import { PERMISSIONS } from '../auth/constants/permissions';
import { 
  CreateDeviceDto, 
  CreateDeviceData, 
  SendMessageDto, 
  SendMessageData,
  GenerateQRDto,
  DisconnectDeviceDto 
} from '../dto/whatsapp.dto';

@Controller('whatsapp')
@ApiTags('whatsapp')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class WhatsAppController {
  constructor(
    private whatsappService: WhatsAppService,
    private whatsappMessageService: WhatsAppMessageService,
    private baileysService: BaileysService,
  ) {}

  @Get('devices')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get WhatsApp devices',
    description: 'Retrieve all WhatsApp devices associated with the authenticated user and tenant'
  })
  @ApiResponse({
    status: 200,
    description: 'Devices retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Devices retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              deviceName: { type: 'string', example: 'My Business WhatsApp' },
              phoneNumber: { type: 'string', example: '+1234567890' },
              status: { type: 'string', enum: ['connected', 'disconnected', 'connecting'], example: 'connected' },
              lastSeen: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
              createdAt: { type: 'string', example: '2025-01-20T10:00:00.000Z' },
              isActive: { type: 'boolean', example: true }
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
    status: 403,
    description: 'Forbidden - Insufficient permissions to view devices'
  })
  async getDevices(@Req() request, @Res() response) {
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
      const devices = await this.whatsappService.getDevices(request.user.userId, request.user.tenantId);
      responseData.message = 'Devices retrieved successfully';
      responseData.data = devices;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve devices!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices')
  @RequirePermissions(PERMISSIONS.CREATE_USER)
  @ApiOperation({
    summary: 'Create WhatsApp device',
    description: 'Create a new WhatsApp device. Device will need to be authenticated with QR code before use.'
  })
  @ApiBody({
    type: CreateDeviceDto,
    examples: {
      businessDevice: {
        summary: 'Business device creation',
        value: {
          deviceName: 'Main Business WhatsApp'
        }
      },
      personalDevice: {
        summary: 'Personal device creation',
        value: {
          deviceName: 'Personal WhatsApp Device'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Device created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device has been created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            deviceName: { type: 'string', example: 'Main Business WhatsApp' },
            status: { type: 'string', example: 'disconnected' },
            qrCodeRequired: { type: 'boolean', example: true },
            createdAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid device data',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Device not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { 
          type: 'string', 
          example: 'Device name must be at least 1 character' 
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to create devices'
  })
  async createDevice(@Req() request, @Res() response, @Body() createDeviceDto: CreateDeviceDto) {
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
      const deviceData: CreateDeviceData = {
        ...createDeviceDto,
        userId: request.user.userId,
        tenantId: request.user.tenantId,
      };
      const device = await this.whatsappService.createDevice(deviceData);
      responseData.message = 'Device has been created successfully';
      responseData.data = device;
      return response.status(HttpStatus.CREATED).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Device not created!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/qr')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async generateQRCode(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.generateQRCode(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'QR code generated successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to generate QR code!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('send')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a WhatsApp message to a contact or group using a connected device'
  })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      textMessage: {
        summary: 'Send text message to contact',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '1234567890@c.us',
          message: 'Hello! This is a test message from our API.',
          type: 'text'
        }
      },
      groupMessage: {
        summary: 'Send message to group',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '120363043211234567@g.us',
          message: 'Hello everyone in the group!',
          type: 'text'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Message sent successfully' },
        data: {
          type: 'object',
          properties: {
            messageId: { type: 'string', example: 'ABC123DEF456' },
            timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
            status: { type: 'string', example: 'sent' },
            to: { type: 'string', example: '1234567890@c.us' },
            deviceId: { type: 'string', example: '507f1f77bcf86cd799439011' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Device not connected or invalid recipient',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to send message!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { 
          type: 'string', 
          example: 'Device is not connected or recipient format is invalid' 
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to send messages'
  })
  async sendMessage(
    @Req() request,
    @Res() response,
    @Body() sendMessageDto: SendMessageDto
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
      const messageData: SendMessageData = {
        ...sendMessageDto,
        userId: request.user.userId,
        tenantId: request.user.tenantId,
      };
      const result = await this.whatsappService.sendMessage(messageData);
      responseData.message = 'Message sent successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to send message!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/disconnect')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async disconnectDevice(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.disconnectDevice(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Device disconnected successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to disconnect device!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Delete('devices/:deviceId')
  @RequirePermissions(PERMISSIONS.DELETE_USER)
  async deleteDevice(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.deleteDevice(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Device deleted successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to delete device!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDeviceById(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const device = await this.whatsappService.findById(deviceId);
      if(!device) {
        responseData.error = 1;
        responseData.message = 'Device not found';
        return response.status(HttpStatus.NOT_FOUND).json(responseData);
      }
      responseData.message = 'Device retrieved successfully';
      responseData.data = device;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve device!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/clear-session')
  @RequirePermissions(PERMISSIONS.DELETE_USER)
  async clearDeviceSession(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.clearDeviceSession(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Device session cleared successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to clear device session!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/force-reconnect')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async forceReconnectDevice(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.forceReconnectDevice(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = result.success ? 'Device reconnection initiated successfully' : 'Failed to initiate reconnection';
      responseData.data = result;
      responseData.error = result.success ? 0 : 1;
      return response.status(result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to reconnect device!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/status')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDeviceConnectionStatus(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const status = await this.whatsappService.getDeviceConnectionStatus(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Device status retrieved successfully';
      responseData.data = status;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get device status!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('connection-info')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getConnectionInfo(@Req() request, @Res() response) {
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
      const info = await this.whatsappService.getConnectionInfo(request.user.userId, request.user.tenantId);
      responseData.message = 'Connection info retrieved successfully';
      responseData.data = info;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get connection info!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/contacts')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDeviceContacts(@Req() request, @Res() response, @Param('deviceId') deviceId: string, @Query('search') search?: string) {
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
      const contacts = await this.whatsappService.getDeviceContacts(deviceId, request.user.userId, request.user.tenantId, search);
      responseData.message = 'Contacts retrieved successfully';
      responseData.data = contacts;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get contacts!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/groups')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDeviceGroups(@Req() request, @Res() response, @Param('deviceId') deviceId: string, @Query('search') search?: string) {
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
      const groups = await this.whatsappService.getDeviceGroups(deviceId, request.user.userId, request.user.tenantId, search);
      responseData.message = 'Groups retrieved successfully';
      responseData.data = groups;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get groups!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/sync/contacts')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async syncDeviceContacts(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.syncDeviceContacts(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Contact sync completed successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to sync contacts!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/sync/groups')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async syncDeviceGroups(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.syncDeviceGroups(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Group sync completed successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to sync groups!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/sync-stats')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDeviceSyncStats(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const stats = await this.whatsappService.getDeviceSyncStats(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Sync stats retrieved successfully';
      responseData.data = stats;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get sync stats!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  // Message Management Endpoints

  @Get('devices/:deviceId/messages')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDeviceMessages(
    @Req() request, 
    @Res() response, 
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string
  ) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const limitNum = limit ? parseInt(limit) : 50;
      const offsetNum = offset ? parseInt(offset) : 0;

      let messages;
      if (search) {
        messages = await this.whatsappMessageService.searchMessages(
          deviceId,
          request.user.userId,
          request.user.tenantId,
          search,
          limitNum
        );
      } else {
        messages = await this.whatsappMessageService.getDeviceMessages(
          deviceId,
          request.user.userId,
          request.user.tenantId,
          limitNum,
          offsetNum
        );
      }

      responseData.message = 'Messages retrieved successfully';
      responseData.data = messages;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get messages!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/chats/:chatId/messages')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getChatMessages(
    @Req() request, 
    @Res() response, 
    @Param('deviceId') deviceId: string,
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const limitNum = limit ? parseInt(limit) : 50;
      const offsetNum = offset ? parseInt(offset) : 0;

      const messages = await this.whatsappMessageService.getChatMessages(
        deviceId,
        chatId,
        limitNum,
        offsetNum
      );

      responseData.message = 'Chat messages retrieved successfully';
      responseData.data = messages;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get chat messages!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/messages/stats')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getMessageStats(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const stats = await this.whatsappMessageService.getMessageStats(
        deviceId,
        request.user.userId,
        request.user.tenantId
      );

      responseData.message = 'Message stats retrieved successfully';
      responseData.data = stats;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get message stats!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/messages/:messageId/delete')
  @RequirePermissions(PERMISSIONS.MANAGE_DEVICES)
  async markMessageDeleted(
    @Req() request, 
    @Res() response, 
    @Param('deviceId') deviceId: string,
    @Param('messageId') messageId: string
  ) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const result = await this.whatsappMessageService.markMessageDeleted(deviceId, messageId);

      responseData.message = 'Message marked as deleted successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to delete message!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/sync/contacts/manual')
  @RequirePermissions(PERMISSIONS.MANAGE_DEVICES)
  async manualContactSync(
    @Req() request, 
    @Res() response, 
    @Param('deviceId') deviceId: string
  ) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const result = await this.baileysService.manualContactSync(deviceId);

      responseData.message = result.message;
      responseData.data = {
        deviceId,
        synced: result.synced,
        success: result.success
      };
      
      const status = result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
      return response.status(status).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to trigger manual contact sync!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/session/reset')
  @RequirePermissions(PERMISSIONS.MANAGE_DEVICES)
  async resetCorruptedSession(
    @Req() request, 
    @Res() response, 
    @Param('deviceId') deviceId: string
  ) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const result = await this.baileysService.forceResetCorruptedSession(deviceId);

      responseData.message = result.message;
      responseData.data = {
        deviceId,
        success: result.success,
        requiresReauth: result.success
      };
      
      const status = result.success ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
      return response.status(status).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to reset session!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Get('devices/:deviceId/diagnostics')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getDiagnostics(
    @Req() request, 
    @Res() response, 
    @Param('deviceId') deviceId: string
  ) {
    const responseData: {
      message: string;
      data: any;
      error: number;
      confidentialErrorMessage?: string;
    } = {
      message: '',
      data: {},
      error: 0,
    };

    try {
      const connectionStatus = await this.baileysService.getConnectionStatus(deviceId);
      const retryStatus = this.baileysService.getDeviceRetryStatus(deviceId);
      const allConnected = this.baileysService.getAllConnectedDevices();

      responseData.message = 'Device diagnostics retrieved successfully';
      responseData.data = {
        deviceId,
        connection: connectionStatus,
        retryInfo: retryStatus,
        isInConnectedList: allConnected.includes(deviceId),
        totalConnectedDevices: allConnected.length,
        timestamp: new Date().toISOString()
      };
      
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to get device diagnostics!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}