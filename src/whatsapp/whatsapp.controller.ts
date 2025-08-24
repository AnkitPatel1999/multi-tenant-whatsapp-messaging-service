import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, Req, HttpStatus, Delete } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
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
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class WhatsAppController {
  constructor(private whatsappService: WhatsAppService) {}

  @Get('devices')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
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
}