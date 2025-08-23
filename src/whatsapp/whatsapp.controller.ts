import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
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
  async getDevices(@Request() req) {
    return this.whatsappService.getDevices(req.user.userId, req.user.tenantId);
  }

  @Post('devices')
  async createDevice(@Request() req, @Body() createDeviceDto: { deviceName: string }) {
    return this.whatsappService.createDevice(req.user.userId, req.user.tenantId, createDeviceDto.deviceName);
  }

  @Post('devices/:deviceId/qr')
  async generateQRCode(@Request() req, @Param('deviceId') deviceId: string) {
    return this.whatsappService.generateQRCode(deviceId, req.user.userId, req.user.tenantId);
  }

  @Post('send')
  async sendMessage(
    @Request() req,
    @Body() sendMessageDto: { deviceId: string; to: string; message: string; type?: 'text' | 'media' }
  ) {
    return this.whatsappService.sendMessage(
      sendMessageDto.deviceId,
      req.user.userId,
      req.user.tenantId,
      sendMessageDto.to,
      sendMessageDto.message,
      sendMessageDto.type || 'text'
    );
  }

  @Post('devices/:deviceId/disconnect')
  async disconnectDevice(@Request() req, @Param('deviceId') deviceId: string) {
    return this.whatsappService.disconnectDevice(deviceId, req.user.userId, req.user.tenantId);
  }
}