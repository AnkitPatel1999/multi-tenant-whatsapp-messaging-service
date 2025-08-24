import { Controller, Get, Post, Body, Param, UseGuards, Request, Res, Req, HttpStatus } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
@TenantScope()
export class WhatsAppController {
  constructor(private whatsappService: WhatsAppService) {}

  @Get('devices')
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
  async createDevice(@Req() request, @Res() response, @Body() createDeviceDto: { deviceName: string }) {
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
      const device = await this.whatsappService.createDevice(request.user.userId, request.user.tenantId, createDeviceDto.deviceName);
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
  async sendMessage(
    @Req() request,
    @Res() response,
    @Body() sendMessageDto: { deviceId: string; to: string; message: string; type?: 'text' | 'media' }
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
      const result = await this.whatsappService.sendMessage(
        sendMessageDto.deviceId,
        request.user.userId,
        request.user.tenantId,
        sendMessageDto.to,
        sendMessageDto.message,
        sendMessageDto.type || 'text'
      );
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
}