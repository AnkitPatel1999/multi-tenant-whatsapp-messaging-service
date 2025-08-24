# Swagger Implementation Examples

This document provides practical examples of how to implement Swagger documentation in the existing Alchemy Backend controllers.

## 🔐 Auth Controller Example

Here's how to enhance the `AuthController` with Swagger documentation:

```typescript
import { Controller, Post, UseGuards, Request, Body, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from '../dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({
    summary: 'User authentication',
    description: 'Authenticate user with email and password to receive JWT access token'
  })
  @ApiBody({
    type: LoginDto,
    description: 'Login credentials',
    examples: {
      admin: {
        summary: 'Admin login example',
        value: {
          email: 'admin@example.com',
          password: 'SecurePassword123!'
        }
      },
      user: {
        summary: 'Regular user login',
        value: {
          email: 'user@example.com',
          password: 'UserPassword456!'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful' },
        data: {
          type: 'object',
          properties: {
            access_token: { 
              type: 'string', 
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' 
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                email: { type: 'string', example: 'user@example.com' },
                role: { type: 'string', example: 'admin' },
                tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' }
              }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed - Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Login failed!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Invalid email or password' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: Login failed!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Email and password are required' }
      }
    }
  })
  async login(@Req() request, @Res() response, @Body() loginDto: LoginDto) {
    // ... existing implementation
  }
}
```

### Enhanced LoginDto

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
    format: 'password'
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;
}
```

## 👥 User Controller Example

Enhanced `UserController` with comprehensive Swagger documentation:

```typescript
import { 
  Controller, Get, Post, Put, Body, Param, UseGuards, Request, Delete, Res, Req, HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiBody 
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { PermissionGuard, RequirePermissions } from '../auth/guards/permission.guard';
import { CreateUserDto, CreateUserData } from '../dto/create-user.dto';
import { PERMISSIONS } from '../auth/constants/permissions';

@Controller('users')
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CREATE_USER)
  @ApiOperation({
    summary: 'Create new user',
    description: 'Create a new user within the authenticated tenant with specified role and permissions'
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User creation data',
    examples: {
      admin: {
        summary: 'Create admin user',
        value: {
          email: 'admin@example.com',
          password: 'SecurePass123!',
          role: 'admin',
          name: 'John Admin'
        }
      },
      user: {
        summary: 'Create regular user',
        value: {
          email: 'user@example.com',
          password: 'UserPass456!',
          role: 'user',
          name: 'Jane User'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User has been created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { type: 'string', example: 'user' },
            tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
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
    description: 'Bad Request - Invalid user data or email already exists',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: User not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string', example: 'Email already exists in tenant' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to create users'
  })
  async createUser(@Req() request, @Res() response, @Body() createUserDto: CreateUserDto) {
    // ... existing implementation
  }

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve all users within the authenticated tenant'
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Users retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              email: { type: 'string', example: 'user@example.com' },
              name: { type: 'string', example: 'John Doe' },
              role: { type: 'string', example: 'user' },
              tenantId: { type: 'string', example: '507f1f77bcf86cd799439012' },
              createdAt: { type: 'string', example: '2025-01-20T12:00:00.000Z' }
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
    status: 403,
    description: 'Forbidden - Insufficient permissions to view users'
  })
  async getAllUsers(@Req() request, @Res() response) {
    // ... existing implementation
  }

  @Get(':userId')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a specific user by their ID within the authenticated tenant'
  })
  @ApiParam({
    name: 'userId',
    description: 'Unique user identifier',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User not found' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 }
      }
    }
  })
  async getUserById(@Req() request, @Res() response, @Param('userId') userId: string) {
    // ... existing implementation
  }

  @Put(':userId/group')
  @RequirePermissions(PERMISSIONS.ASSIGN_USERS_TO_GROUPS)
  @ApiOperation({
    summary: 'Assign user to group',
    description: 'Assign a user to a specific group within the tenant'
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to assign to group',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiBody({
    description: 'Group assignment data',
    schema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', example: '507f1f77bcf86cd799439013' }
      },
      required: ['groupId']
    },
    examples: {
      assignment: {
        summary: 'Assign to group',
        value: { groupId: '507f1f77bcf86cd799439013' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'User assigned to group successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User or group not found'
  })
  async assignUserToGroup(
    @Req() request,
    @Res() response,
    @Param('userId') userId: string,
    @Body() body: { groupId: string }
  ) {
    // ... existing implementation
  }

  @Delete(':userId')
  @RequirePermissions(PERMISSIONS.DELETE_USER)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Permanently delete a user from the tenant'
  })
  @ApiParam({
    name: 'userId',
    description: 'ID of user to delete',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot delete yourself or insufficient permissions'
  })
  async deleteUser(@Req() request, @Res() response, @Param('userId') userId: string) {
    // ... existing implementation
  }
}
```

## 📱 WhatsApp Controller Example

Key endpoints from the `WhatsAppController` with Swagger documentation:

```typescript
import { 
  Controller, Get, Post, Body, Param, UseGuards, Request, Res, Req, HttpStatus, Delete, Query 
} from '@nestjs/common';
import { 
  ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody 
} from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppMessageService } from './message/whatsapp-message.service';
// ... other imports

@Controller('whatsapp')
@ApiTags('whatsapp')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class WhatsAppController {
  // ... constructor

  @Get('devices')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get WhatsApp devices',
    description: 'Retrieve all WhatsApp devices associated with the authenticated user and tenant'
  })
  @ApiResponse({
    status: 200,
    description: 'Devices retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Devices retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              name: { type: 'string', example: 'My WhatsApp Device' },
              phoneNumber: { type: 'string', example: '+1234567890' },
              status: { type: 'string', enum: ['connected', 'disconnected', 'connecting'], example: 'connected' },
              lastSeen: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
              createdAt: { type: 'string', example: '2025-01-20T10:00:00.000Z' }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async getDevices(@Req() request, @Res() response) {
    // ... existing implementation
  }

  @Post('devices')
  @RequirePermissions(PERMISSIONS.CREATE_USER)
  @ApiOperation({
    summary: 'Create WhatsApp device',
    description: 'Create a new WhatsApp device. Device will need to be authenticated with QR code before use.'
  })
  @ApiBody({
    type: CreateDeviceDto,
    examples: {
      device: {
        summary: 'New device creation',
        value: {
          name: 'My Business WhatsApp',
          description: 'Primary business communication device'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Device created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Device has been created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'My Business WhatsApp' },
            status: { type: 'string', example: 'disconnected' },
            qrCodeRequired: { type: 'boolean', example: true }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async createDevice(@Req() request, @Res() response, @Body() createDeviceDto: CreateDeviceDto) {
    // ... existing implementation
  }

  @Post('devices/:deviceId/qr')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Generate QR code',
    description: 'Generate QR code for WhatsApp authentication. Scan with WhatsApp mobile app to connect device.'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to generate QR code for',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({
    status: 200,
    description: 'QR code generated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'QR code generated successfully' },
        data: {
          type: 'object',
          properties: {
            qrCode: { type: 'string', description: 'Base64 encoded QR code image', example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' },
            qrText: { type: 'string', description: 'QR code text for manual entry', example: '1@ABC123DEF...' },
            expiresIn: { type: 'number', description: 'QR code expiration time in seconds', example: 300 }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Device already connected or invalid device state'
  })
  async generateQRCode(@Req() request, @Res() response, @Param('deviceId') deviceId: string) {
    // ... existing implementation
  }

  @Post('send')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Send WhatsApp message',
    description: 'Send a WhatsApp message to a contact or group using a connected device'
  })
  @ApiBody({
    type: SendMessageDto,
    examples: {
      textMessage: {
        summary: 'Send text message',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '1234567890@c.us',
          message: 'Hello! This is a test message.',
          type: 'text'
        }
      },
      groupMessage: {
        summary: 'Send group message',
        value: {
          deviceId: '507f1f77bcf86cd799439011',
          to: '120363043211234567@g.us',
          message: 'Hello everyone in the group!',
          type: 'text'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Message sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Message sent successfully' },
        data: {
          type: 'object',
          properties: {
            messageId: { type: 'string', example: 'ABC123DEF456' },
            timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
            status: { type: 'string', example: 'sent' },
            to: { type: 'string', example: '1234567890@c.us' }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Device not connected or invalid recipient'
  })
  async sendMessage(@Req() request, @Res() response, @Body() sendMessageDto: SendMessageDto) {
    // ... existing implementation
  }

  @Get('devices/:deviceId/messages')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  @ApiOperation({
    summary: 'Get device messages',
    description: 'Retrieve messages for a specific WhatsApp device with optional search and pagination'
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device ID to get messages for',
    type: 'string',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of messages to return',
    type: 'number',
    required: false,
    example: 50
  })
  @ApiQuery({
    name: 'offset',
    description: 'Number of messages to skip (for pagination)',
    type: 'number',
    required: false,
    example: 0
  })
  @ApiQuery({
    name: 'search',
    description: 'Search term to filter messages by content',
    type: 'string',
    required: false,
    example: 'hello world'
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Messages retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'MSG123' },
                  content: { type: 'string', example: 'Hello, how are you?' },
                  from: { type: 'string', example: '1234567890@c.us' },
                  to: { type: 'string', example: '0987654321@c.us' },
                  timestamp: { type: 'string', example: '2025-01-20T12:00:00.000Z' },
                  type: { type: 'string', example: 'text' },
                  direction: { type: 'string', enum: ['incoming', 'outgoing'], example: 'outgoing' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 150 },
                limit: { type: 'number', example: 50 },
                offset: { type: 'number', example: 0 },
                hasMore: { type: 'boolean', example: true }
              }
            }
          }
        },
        error: { type: 'number', example: 0 }
      }
    }
  })
  async getDeviceMessages(
    @Req() request,
    @Res() response,
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string
  ) {
    // ... existing implementation
  }
}
```

## 📋 Enhanced DTOs

### CreateUserDto with Swagger

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address - must be unique within tenant',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User password - minimum 8 characters',
    example: 'SecurePassword123!',
    minLength: 8,
    format: 'password'
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({
    description: 'User display name',
    example: 'John Doe'
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'User role within the tenant',
    enum: ['admin', 'user', 'viewer'],
    example: 'user',
    default: 'user'
  })
  @IsEnum(['admin', 'user', 'viewer'], { message: 'Role must be admin, user, or viewer' })
  role: string = 'user';
}
```

### WhatsApp DTOs with Swagger

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({
    description: 'Device name for identification',
    example: 'My Business WhatsApp',
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty({ message: 'Device name is required' })
  name: string;

  @ApiPropertyOptional({
    description: 'Optional device description',
    example: 'Primary business communication device',
    maxLength: 255
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class SendMessageDto {
  @ApiProperty({
    description: 'Device ID to send message from',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty({ message: 'Device ID is required' })
  deviceId: string;

  @ApiProperty({
    description: 'Recipient phone number or group ID in WhatsApp format',
    example: '1234567890@c.us',
    pattern: '^[0-9]+@[csg]\\.us$'
  })
  @IsString()
  @IsNotEmpty({ message: 'Recipient is required' })
  to: string;

  @ApiProperty({
    description: 'Message content to send',
    example: 'Hello! This is a test message from the API.',
    maxLength: 4096
  })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  message: string;

  @ApiProperty({
    description: 'Type of message to send',
    enum: ['text', 'image', 'document', 'audio'],
    example: 'text',
    default: 'text'
  })
  @IsEnum(['text', 'image', 'document', 'audio'])
  type: string = 'text';
}
```

## 🔍 Testing the Implementation

### 1. Start the Application

```bash
npm run start:dev
```

### 2. Access Swagger Documentation

Navigate to: http://localhost:3000/api/docs

### 3. Test Authentication Flow

1. **Expand Auth section** → `POST /auth/login`
2. **Click "Try it out"**
3. **Enter credentials**:
   ```json
   {
     "email": "admin@example.com",
     "password": "password123"
   }
   ```
4. **Execute** and copy the `access_token`

### 4. Authorize for Protected Endpoints

1. **Click the "Authorize" button** at the top right
2. **Enter token** in format: `Bearer <your-access-token>`
3. **Click "Authorize"**

### 5. Test Protected Endpoints

Now you can test any protected endpoint like:
- `GET /users` - Get all users
- `POST /whatsapp/devices` - Create device
- `GET /whatsapp/devices` - Get devices

## 🎯 Next Steps

1. **Apply to All Controllers**: Add similar documentation to remaining controllers
2. **Create Response DTOs**: Define proper response DTOs for type safety
3. **Add More Examples**: Include more realistic example data
4. **Environment Configuration**: Set up different configs for dev/prod
5. **Custom Validation**: Add custom validation decorators with Swagger support

---

This implementation provides comprehensive API documentation that will help developers understand and interact with your WhatsApp backend API effectively.