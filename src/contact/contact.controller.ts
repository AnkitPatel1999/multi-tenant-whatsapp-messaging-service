import { Controller, Get, Post, Body, UseGuards, Request, Query, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { CreateContactDto } from '../dto/create-contact.dto';

@Controller('contacts')
@ApiTags('contacts')
@ApiBearerAuth('JWT-auth')
// @UseGuards(JwtAuthGuard, TenantScopeGuard)
// @TenantScope()
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new contact',
    description: 'Create a new contact in the system for WhatsApp messaging and contact management'
  })
  @ApiBody({
    type: CreateContactDto,
    description: 'Contact information to create',
    examples: {
      businessContact: {
        summary: 'Business contact example',
        value: {
          contactName: 'John Smith - ABC Corp',
          phoneNumber: '+1234567890',
          email: 'john.smith@abccorp.com',
          notes: 'Key decision maker for project X'
        }
      },
      personalContact: {
        summary: 'Personal contact example',
        value: {
          contactName: 'Sarah Johnson',
          phoneNumber: '+1987654321',
          email: 'sarah.j@gmail.com',
          notes: 'Family friend'
        }
      },
      minimalContact: {
        summary: 'Minimal contact (only required fields)',
        value: {
          contactName: 'Mike Wilson',
          phoneNumber: '+1555123456'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Contact created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Contact has been created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            contactName: { type: 'string', example: 'John Smith - ABC Corp' },
            phoneNumber: { type: 'string', example: '+1234567890' },
            email: { type: 'string', example: 'john.smith@abccorp.com' },
            notes: { type: 'string', example: 'Key decision maker for project X' },
            tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439013' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
            updatedAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid contact data or validation errors',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Contact not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { 
          type: 'string', 
          example: 'Phone number must be at least 8 digits' 
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Contact with this phone number already exists',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Contact not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { 
          type: 'string', 
          example: 'Contact with phone number +1234567890 already exists' 
        }
      }
    }
  })
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
      // console.log('User info:', { tenantId: request.user.tenantId, userId: request.user.userId });
      
      const contactData = {
        contactName: createContactDto.contactName,
        phoneNumber: createContactDto.phoneNumber,
        email: createContactDto.email,
        notes: createContactDto.notes,
        tenantId: 'test-tenant-id', // Temporary for testing
        userId: 'test-user-id', // Temporary for testing
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
  @ApiOperation({
    summary: 'Get all contacts',
    description: 'Retrieve all contacts for the authenticated user within their tenant, with optional filtering by userId'
  })
  @ApiQuery({
    name: 'userId',
    description: 'Optional user ID to filter contacts by specific user',
    type: 'string',
    required: false,
    example: '507f1f77bcf86cd799439013'
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
              id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              contactName: { type: 'string', example: 'John Smith - ABC Corp' },
              phoneNumber: { type: 'string', example: '+1234567890' },
              email: { type: 'string', example: 'john.smith@abccorp.com' },
              notes: { type: 'string', example: 'Key decision maker for project X' },
              isActive: { type: 'boolean', example: true },
              createdAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
              updatedAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
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
    status: 400,
    description: 'Bad Request - Error retrieving contacts',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Failed to retrieve contacts!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Database connection error' }
      }
    }
  })
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
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

}