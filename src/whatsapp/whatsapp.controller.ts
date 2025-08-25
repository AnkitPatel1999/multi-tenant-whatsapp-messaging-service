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
  @ApiOperation({
    summary: 'Generate QR code',
    description: 'Generate QR code for WhatsApp authentication. Scan with WhatsApp mobile app to connect device.'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to generate QR code for',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'QR code generated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'QR code generated successfully' },
        data: {
          type: 'object',
          properties: {
            deviceId: { type: 'string', example: 'e8daab9d-47f8-4377-89c9-578ec6d7312e' },
            qrCode: { type: 'string', description: 'QR code text for manual entry', example: '2@REK9ktsEzXOZNiExmNwcgN47C5oyxwEJoSuhevpGg3I+T2nRyPQ3ndHrupIalBrpsU4g3SBOhMrLNIvRLlIFj919PLgTN5iV/fU=' },
            qrCodeImage: { type: 'string', description: 'Base64 encoded QR code image (data URL)', example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' },
            qrCodeBase64: { type: 'string', description: 'Base64 string without data URL prefix', example: 'iVBORw0KGgoAAAANSUhEUgAA...' },
            qrExpiry: { type: 'string', description: 'QR code expiration timestamp', example: '2025-08-24T17:20:27.804Z' },
            isConnected: { type: 'boolean', example: false }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Device already connected or invalid device state',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to generate QR code!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device is already connected' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Device not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to generate QR code!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device not found' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
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
  @RequirePermissions(PERMISSIONS.SEND_MESSAGES)
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a WhatsApp message to a phone number or group from a specified linked device'
  })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      textMessage: {
        summary: 'Send text message',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '+1234567890',
          message: 'Hello! This is a test message from our business WhatsApp.',
          messageType: 'text'
        }
      },
      groupMessage: {
        summary: 'Send message to group',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '120363043211234567@g.us',
          message: 'Important announcement for the team!',
          messageType: 'text'
        }
      },
      mediaMessage: {
        summary: 'Send media message',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '+1234567890',
          message: 'Check out our new product catalog!',
          messageType: 'image',
          mediaUrl: 'https://example.com/catalog.pdf'
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
            messageId: { type: 'string', example: 'MSG123456789' },
            deviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            to: { type: 'string', example: '+1234567890' },
            message: { type: 'string', example: 'Hello! This is a test message.' },
            messageType: { type: 'string', example: 'text' },
            status: { type: 'string', example: 'sent' },
            timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid message data or device not connected',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Message not sent!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device is not connected' }
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
  @ApiResponse({
    status: 404,
    description: 'Device not found or not accessible',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Message not sent!' },
        data: { type: 'string', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device not found' }
      }
    }
  })
  async sendMessage(@Req() request, @Res() response, @Body() sendMessageDto: SendMessageDto) {
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
      responseData.message = 'Error: Message not sent!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  // Get WhatsApp messages for a specific device
  @Get('devices/:deviceId/messages')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get WhatsApp messages for device',
    description: 'Retrieve WhatsApp messages stored for a specific device from the whatsapp_messages collection'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'ID of the WhatsApp device',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
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
              messageId: { type: 'string', example: 'MSG123456789' },
              deviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
              chatId: { type: 'string', example: '1234567890@c.us' },
              textContent: { type: 'string', example: 'Hello, how are you?' },
              messageType: { type: 'string', example: 'text' },
              direction: { type: 'string', example: 'incoming' },
              timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
              status: { type: 'string', example: 'delivered' }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async getDeviceMessages(
    @Req() request,
    @Res() response,
    @Param('deviceId') deviceId: string
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
      const messages = await this.whatsappMessageService.getDeviceMessages(
        deviceId,
        100 // limit
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

  // Get WhatsApp contacts for a specific device
  @Get('devices/:deviceId/contacts')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get WhatsApp contacts for device',
    description: 'Retrieve WhatsApp contacts stored for a specific device from the whatsapp_contacts collection'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'ID of the WhatsApp device',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Contacts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Contacts retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              contactId: { type: 'string', example: '1234567890@c.us' },
              deviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
              name: { type: 'string', example: 'John Doe' },
              phoneNumber: { type: 'string', example: '+1234567890' },
              pushName: { type: 'string', example: 'John' },
              isBusiness: { type: 'boolean', example: false },
              lastSeen: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async getDeviceContacts(
    @Req() request,
    @Res() response,
    @Param('deviceId') deviceId: string
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
      // This would need to be implemented in the WhatsApp service
      // For now, returning a placeholder
      responseData.message = 'Contacts retrieved successfully';
      responseData.data = [];
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve contacts!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  // Get WhatsApp groups for a specific device
  @Get('devices/:deviceId/groups')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get WhatsApp groups for device',
    description: 'Retrieve WhatsApp groups stored for a specific device from the whatsapp_groups collection'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'ID of the WhatsApp device',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
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
              groupId: { type: 'string', example: '120363043211234567@g.us' },
              deviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
              name: { type: 'string', example: 'Project Team' },
              description: { type: 'string', example: 'Main project discussion group' },
              memberCount: { type: 'number', example: 15 },
              isGroup: { type: 'boolean', example: true },
              lastSeen: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async getDeviceGroups(
    @Req() request,
    @Res() response,
    @Param('deviceId') deviceId: string
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
      // This would need to be implemented in the WhatsApp service
      // For now, returning a placeholder
      responseData.message = 'Groups retrieved successfully';
      responseData.data = [];
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve groups!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  // Get detailed device information including session status
  @Get('devices/:deviceId/details')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get detailed device information',
    description: 'Retrieve detailed WhatsApp device information including session status from whatsapp_devices and whatsapp_sessions collections'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'ID of the WhatsApp device',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Device details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device details retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            device: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                deviceName: { type: 'string', example: 'Business WhatsApp' },
                phoneNumber: { type: 'string', example: '+1234567890' },
                status: { type: 'string', example: 'connected' },
                isActive: { type: 'boolean', example: true },
                createdAt: { type: 'string', example: '2025-01-20T10:00:00.000Z' }
              }
            },
            session: {
              type: 'object',
              properties: {
                isConnected: { type: 'boolean', example: true },
                lastSeen: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
                connectionStatus: { type: 'string', example: 'open' }
              }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async getDeviceDetails(
    @Req() request,
    @Res() response,
    @Param('deviceId') deviceId: string
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
      const device = await this.whatsappService.findById(deviceId);
      if (!device) {
        responseData.error = 1;
        responseData.message = 'Device not found';
        return response.status(HttpStatus.NOT_FOUND).json(responseData);
      }

      // Get connection status from Baileys service
      let connectionStatus = { isConnected: false, lastSeen: null, connectionStatus: 'disconnected' };
      try {
        connectionStatus = await this.baileysService.getConnectionStatus(deviceId);
      } catch (err) {
        // Connection status unavailable, use default
      }

      responseData.message = 'Device details retrieved successfully';
      responseData.data = {
        device: {
          id: device.id,
          deviceName: device.deviceName,
          phoneNumber: device.phoneNumber,
          status: device.status,
          isActive: device.isActive,
          createdAt: device.createdAt
        },
        session: connectionStatus
      };
      
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve device details!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/:deviceId/disconnect')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Disconnect WhatsApp device',
    description: 'Disconnect a WhatsApp device and end the session'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to disconnect',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Device disconnected successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device disconnected successfully' },
        data: {
          type: 'object',
          properties: {
            deviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            status: { type: 'string', example: 'disconnected' },
            disconnectedAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Device not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to disconnect device!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device not found' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Device already disconnected',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to disconnect device!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device is already disconnected' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
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
  @ApiOperation({
    summary: 'Delete WhatsApp device',
    description: 'Permanently delete a WhatsApp device and all associated data'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to delete',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Device deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device deleted successfully' },
        data: {
          type: 'object',
          properties: {
            deletedDeviceId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            deletedAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Device not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to delete device!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Device not found' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to delete devices'
  })
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
  @ApiOperation({
    summary: 'Get WhatsApp device by ID',
    description: 'Retrieve detailed information about a specific WhatsApp device'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Unique device identifier',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'Device retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            deviceName: { type: 'string', example: 'My Business WhatsApp' },
            phoneNumber: { type: 'string', example: '+1234567890' },
            status: { type: 'string', enum: ['connected', 'disconnected', 'connecting'], example: 'connected' },
            lastSeen: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
            createdAt: { type: 'string', example: '2025-01-20T10:00:00.000Z' },
            isActive: { type: 'boolean', example: true },
            tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439013' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Device not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device not found' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to view device details'
  })
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

  @Post('devices/:deviceId/sync-connection-status')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Sync device connection status',
    description: 'Manually sync the device connection status with the actual connection state'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to sync connection status for',
    type: 'string',
    example: '68a6f42f-806a-43d1-9f64-18c25a4f944f'
  })
  @ApiResponse({
    status: 200,
    description: 'Connection status synced successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Connection status synced successfully' },
        data: {
          type: 'object',
          properties: {
            deviceId: { type: 'string', example: '68a6f42f-806a-43d1-9f64-18c25a4f944f' },
            previousStatus: { type: 'boolean', example: false },
            currentStatus: { type: 'boolean', example: true },
            synced: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Device connection status synced from false to true' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async syncDeviceConnectionStatus(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
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
      const result = await this.whatsappService.syncDeviceConnectionStatus(deviceId, request.user.userId, request.user.tenantId);
      responseData.message = 'Connection status synced successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to sync connection status!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post('devices/refresh-all-connection-statuses')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Refresh all device connection statuses',
    description: 'Bulk refresh connection statuses for all devices to ensure database synchronization'
  })
  @ApiResponse({
    status: 200,
    description: 'All device connection statuses refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'All device connection statuses refreshed successfully' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Connection statuses refreshed for 2 devices' },
            totalDevices: { type: 'number', example: 2 },
            syncedDevices: { type: 'number', example: 1 },
            failedDevices: { type: 'number', example: 0 },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  deviceId: { type: 'string', example: '68a6f42f-806a-43d1-9f64-18c25a4f944f' },
                  previousStatus: { type: 'boolean', example: false },
                  currentStatus: { type: 'boolean', example: true },
                  synced: { type: 'boolean', example: true }
                }
              }
            },
            timestamp: { type: 'string', example: '2025-08-24T17:45:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async refreshAllDeviceConnectionStatuses(@Req() request, @Res() response) {
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
      const result = await this.whatsappService.refreshAllDeviceConnectionStatuses();
      responseData.message = 'All device connection statuses refreshed successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to refresh all device connection statuses!';
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