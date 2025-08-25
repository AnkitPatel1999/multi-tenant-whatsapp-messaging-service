import { Controller, Get, Post, Body, UseGuards, Request, Query, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';


@Controller('contacts')
@ApiTags('contacts')
@ApiBearerAuth('JWT-auth')
// @UseGuards(JwtAuthGuard, TenantScopeGuard)
// @TenantScope()
export class ContactController {
  constructor(private contactService: ContactService) {}



  
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