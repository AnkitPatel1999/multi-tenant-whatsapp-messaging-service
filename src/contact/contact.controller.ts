import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard, TenantScopeGuard)
@TenantScope()
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Get()
  async getContacts(@Request() req, @Query('userId') userId?: string) {
    return this.contactService.getContacts(req.user.tenantId, userId);
  }

  @Post()
  async createContact(@Request() req, @Body() createContactDto: any) {
    return this.contactService.createContact({
      ...createContactDto,
      tenantId: req.user.tenantId,
      userId: req.user.userId,
    });
  }
}