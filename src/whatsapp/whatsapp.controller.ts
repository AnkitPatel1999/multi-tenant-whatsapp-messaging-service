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
    try {
      const devices = await this.whatsappService.getDevices(request.user.userId, request.user.tenantId);
      return response.status(HttpStatus.OK).json({
        message: 'Devices retrieved successfully',
        devices
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to retrieve devices!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Post('devices')
  async createDevice(@Req() request, @Res() response, @Body() createDeviceDto: { deviceName: string }) {
    try {
      const device = await this.whatsappService.createDevice(request.user.userId, request.user.tenantId, createDeviceDto.deviceName);
      return response.status(HttpStatus.CREATED).json({
        message: 'Device has been created successfully',
        device
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Device not created!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Post('devices/:deviceId/qr')
  async generateQRCode(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
    try {
      const result = await this.whatsappService.generateQRCode(deviceId, request.user.userId, request.user.tenantId);
      return response.status(HttpStatus.OK).json({
        message: 'QR code generated successfully',
        ...result
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to generate QR code!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Post('send')
  async sendMessage(
    @Req() request,
    @Res() response,
    @Body() sendMessageDto: { deviceId: string; to: string; message: string; type?: 'text' | 'media' }
  ) {
    try {
      const result = await this.whatsappService.sendMessage(
        sendMessageDto.deviceId,
        request.user.userId,
        request.user.tenantId,
        sendMessageDto.to,
        sendMessageDto.message,
        sendMessageDto.type || 'text'
      );
      return response.status(HttpStatus.OK).json({
        message: 'Message sent successfully',
        ...result
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to send message!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Post('devices/:deviceId/disconnect')
  async disconnectDevice(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
    try {
      const result = await this.whatsappService.disconnectDevice(deviceId, request.user.userId, request.user.tenantId);
      return response.status(HttpStatus.OK).json({
        message: 'Device disconnected successfully',
        ...result
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to disconnect device!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }
}