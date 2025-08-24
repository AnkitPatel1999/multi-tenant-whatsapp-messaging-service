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
      const contacts = await this.contactService.getContacts(request.user.tenantId, userId);
      responseData.message = 'Contacts retrieved successfully';
      responseData.data = contacts;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve contacts!';
      responseData.confidentialErrorMessage = err.message;
      delete responseData.confidentialErrorMessage;
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Post()
  async createContact(@Req() request, @Res() response, @Body() createContactDto: any) {
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
      const contactData = {
        ...createContactDto,
        tenantId: request.user.tenantId,
        userId: request.user.userId,
      };
      const contact = await this.contactService.createContact(contactData);
      responseData.message = 'Contact has been created successfully';
      responseData.data = contact;
      return response.status(HttpStatus.CREATED).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Contact not created!';
      responseData.confidentialErrorMessage = err.message;
      delete responseData.confidentialErrorMessage;
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}