import { Controller, Get, Post, Body, UseGuards, Request, Query, Res, Req, HttpStatus } from '@nestjs/common';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { CreateContactDto } from '../dto/create-contact.dto';
import { PermissionGuard, RequirePermissions } from '../auth/guards/permission.guard';
import { PERMISSIONS } from '../auth/constants/permissions';
import { GetContactsQueryDto } from '../dto/get-contacts-query.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class ContactController {
  constructor(private contactService: ContactService) {
    console.log('ContactController constructor called');
  }


  @Post()
  @RequirePermissions(PERMISSIONS.MANAGE_CONTACTS)
  async createContact(@Req() request, @Res() response, @Body() createContactDto: CreateContactDto) {
    console.log('createContact api called');
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
      // Log the raw request body for debugging
      console.log('Raw request body:', request.body);
      console.log('Parsed DTO:', createContactDto);
      console.log('DTO types:', {
        contactName: typeof createContactDto.contactName,
        phoneNumber: typeof createContactDto.phoneNumber
      });
      
      const contactData = {
        contactName: createContactDto.contactName,
        phoneNumber: createContactDto.phoneNumber,
        email: createContactDto.email,
        notes: createContactDto.notes,
        tenantId: request.user.tenantId,
        userId: request.user.userId,
        isActive: true
      };
      
      console.log('Final contact data to save:', contactData);
      
      const contact = await this.contactService.createContact(contactData);
      responseData.message = 'Contact has been created successfully';
      responseData.data = contact;
      return response.status(HttpStatus.CREATED).json(responseData);
    } catch (err) {
      console.error('Contact creation error:', err);
      responseData.error = 1;
      responseData.message = 'Error: Contact not created!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  
  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_CONTACTS)
  async getContacts(@Req() request, @Res() response, @Query() query: GetContactsQueryDto) {
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
      const contacts = await this.contactService.getContacts(request.user.tenantId, query.userId);
      responseData.message = 'Contacts retrieved successfully';
      responseData.data = contacts;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve contacts!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

}