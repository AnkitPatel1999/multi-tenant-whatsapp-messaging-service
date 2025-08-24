import { Controller, Get, Post, Body, UseGuards, Request, Query, Res, Req, HttpStatus } from '@nestjs/common';
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
  async getContacts(@Req() request, @Res() response, @Query('userId') userId?: string) {
    try {
      const contacts = await this.contactService.getContacts(request.user.tenantId, userId);
      return response.status(HttpStatus.OK).json({
        message: 'Contacts retrieved successfully',
        contacts
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to retrieve contacts!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Post()
  async createContact(@Req() request, @Res() response, @Body() createContactDto: any) {
    try {
      const contactData = {
        ...createContactDto,
        tenantId: request.user.tenantId,
        userId: request.user.userId,
      };
      const contact = await this.contactService.createContact(contactData);
      return response.status(HttpStatus.CREATED).json({
        message: 'Contact has been created successfully',
        contact
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Contact not created!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }
}