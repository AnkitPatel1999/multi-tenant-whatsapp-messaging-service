# Swagger API Documentation Guide

## Overview

This guide explains how to use and contribute to the Swagger API documentation for the Alchemy Backend application. Swagger provides interactive API documentation that allows developers to explore, test, and understand the API endpoints.

## 🚀 Accessing Swagger Documentation

Once the application is running, you can access the interactive Swagger documentation at:

**Local Development:** http://localhost:3000/api/docs

The documentation includes:
- Interactive API explorer
- Request/response schemas
- Authentication setup
- Example requests and responses
- Error codes and descriptions

## 📦 Dependencies

The following packages are required for Swagger functionality:

```json
{
  "@nestjs/swagger": "^7.0.0",
  "swagger-ui-express": "^5.0.0"
}
```

## ⚙️ Configuration

### Main Application Setup

Swagger is configured in `src/main.ts` with the following settings:

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Alchemy Backend API')
  .setDescription('WhatsApp messaging backend API with multi-tenant support')
  .setVersion('1.0')
  .addTag('auth', 'Authentication endpoints')
  .addTag('users', 'User management endpoints')
  .addTag('whatsapp', 'WhatsApp device and messaging endpoints')
  .addBearerAuth({
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Enter JWT token',
  }, 'JWT-auth')
  .build();
```

### Custom Swagger Options

```typescript
SwaggerModule.setup('api/docs', app, document, {
  swaggerOptions: {
    persistAuthorization: true,    // Remember auth tokens
    tagsSorter: 'alpha',          // Sort tags alphabetically
    operationsSorter: 'alpha',    // Sort operations alphabetically
    docExpansion: 'none',         // Collapse all sections by default
    filter: true,                 // Enable search filter
    showRequestHeaders: true,     // Show request headers
  },
  customSiteTitle: 'Alchemy API Documentation',
});
```

## 📝 Documentation Decorators

### Controller-Level Decorators

```typescript
import { 
  ApiTags, 
  ApiBearerAuth, 
  ApiOperation, 
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody 
} from '@nestjs/swagger';

@Controller('auth')
@ApiTags('auth')  // Groups endpoints under 'auth' tag
export class AuthController {
  // controller methods...
}
```

### Method-Level Decorators

#### Basic Operation Documentation

```typescript
@Post('login')
@ApiOperation({ 
  summary: 'User login', 
  description: 'Authenticate user with email and password' 
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
          access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '507f1f77bcf86cd799439011' },
              email: { type: 'string', example: 'user@example.com' },
              role: { type: 'string', example: 'admin' }
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
  description: 'Authentication failed',
  schema: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Error: Login failed!' },
      data: { type: 'object', example: {} },
      error: { type: 'number', example: 1 },
      confidentialErrorMessage: { type: 'string', example: 'Invalid credentials' }
    }
  }
})
async login(@Body() loginDto: LoginDto) {
  // method implementation...
}
```

#### Protected Endpoints

```typescript
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')  // Indicates JWT authentication required
@ApiOperation({ summary: 'Get all users', description: 'Retrieve all users in the tenant' })
@ApiResponse({ status: 200, description: 'Users retrieved successfully' })
@ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
@ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
@Get()
async getAllUsers() {
  // method implementation...
}
```

#### Parameters and Queries

```typescript
@Get('devices/:deviceId/messages')
@ApiBearerAuth('JWT-auth')
@ApiOperation({ 
  summary: 'Get device messages', 
  description: 'Retrieve messages for a specific device with optional filtering' 
})
@ApiParam({ 
  name: 'deviceId', 
  description: 'Unique device identifier',
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
  description: 'Number of messages to skip',
  type: 'number',
  required: false,
  example: 0
})
@ApiQuery({ 
  name: 'search', 
  description: 'Search term for message content',
  type: 'string',
  required: false,
  example: 'hello world'
})
async getDeviceMessages(
  @Param('deviceId') deviceId: string,
  @Query('limit') limit?: string,
  @Query('offset') offset?: string,
  @Query('search') search?: string
) {
  // method implementation...
}
```

## 🏗️ DTOs and Schema Documentation

### Basic DTO Example

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
```

### Complex DTO with Nested Objects

```typescript
export class SendMessageDto {
  @ApiProperty({
    description: 'Target phone number or group ID',
    example: '1234567890@c.us',
    pattern: '^[0-9]+@[sc]\\.us$'
  })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, this is a test message!',
    maxLength: 1000
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Message type',
    enum: ['text', 'image', 'document', 'audio'],
    example: 'text'
  })
  @IsEnum(['text', 'image', 'document', 'audio'])
  type: string;

  @ApiProperty({
    description: 'Device ID to send message from',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;
}
```

### Optional Properties

```typescript
export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'newuser@example.com'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    required: false  // This makes it optional in Swagger UI
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'User role',
    enum: ['admin', 'user', 'viewer'],
    default: 'user'
  })
  @IsEnum(['admin', 'user', 'viewer'])
  role: string = 'user';
}
```

## 📊 Standard Response Schema

All API endpoints in this application follow a standardized response format:

```typescript
// Success Response
{
  "message": "Operation completed successfully",
  "data": {
    // Actual response data
  },
  "error": 0
}

// Error Response
{
  "message": "Error: Operation failed!",
  "data": {},
  "error": 1,
  "confidentialErrorMessage": "Detailed error message for debugging"
}
```

### Documenting Standard Responses

```typescript
const standardResponses = {
  success: {
    status: 200,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        data: { type: 'object' },
        error: { type: 'number', example: 0 }
      }
    }
  },
  error: {
    status: 400,
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { type: 'string' }
      }
    }
  }
};

@ApiResponse(standardResponses.success)
@ApiResponse(standardResponses.error)
```

## 🔐 Authentication in Swagger

### Setup Bearer Token

1. Click the "Authorize" button in Swagger UI
2. Enter your JWT token in the format: `Bearer <your-token>`
3. Click "Authorize"
4. All subsequent requests will include the authorization header

### Obtaining JWT Token

1. Use the `/auth/login` endpoint first
2. Copy the `access_token` from the response
3. Use it in the Authorize dialog

## 🎯 Best Practices

### 1. Comprehensive Descriptions

```typescript
@ApiOperation({ 
  summary: 'Create WhatsApp device',
  description: `
    Creates a new WhatsApp device for the authenticated user.
    The device will need to be authenticated with a QR code before it can send messages.
    Each user can have multiple devices, but each device must have a unique name within the tenant.
  `
})
```

### 2. Realistic Examples

```typescript
@ApiProperty({
  description: 'Phone number in international format',
  example: '1234567890@c.us',
  pattern: '^[0-9]+@c\\.us$'  // WhatsApp contact format
})
```

### 3. Proper Error Documentation

```typescript
@ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
@ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
@ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
@ApiResponse({ status: 404, description: 'Not Found - Resource does not exist' })
@ApiResponse({ status: 500, description: 'Internal Server Error' })
```

### 4. Group Related Endpoints

```typescript
@Controller('whatsapp')
@ApiTags('whatsapp')
export class WhatsAppController {
  // All WhatsApp-related endpoints grouped together
}
```

### 5. Version Your API

```typescript
@Controller({ path: 'users', version: '1' })
@ApiTags('users-v1')
export class UserV1Controller {
  // Version 1 endpoints
}
```

## 🧪 Testing with Swagger

### Manual Testing Steps

1. **Navigate to Swagger UI**: http://localhost:3000/api/docs
2. **Authenticate**: Use the login endpoint to get a JWT token
3. **Set Authorization**: Click "Authorize" and enter your token
4. **Test Endpoints**: Use the "Try it out" button on any endpoint
5. **Review Responses**: Check the response format and status codes

### Example Test Flow

1. **Login**:
   ```json
   POST /auth/login
   {
     "email": "admin@example.com",
     "password": "password123"
   }
   ```

2. **Copy Token** from the response

3. **Authorize** in Swagger UI with the token

4. **Test Protected Endpoint**:
   ```json
   GET /users
   Authorization: Bearer <your-token>
   ```

## 🔧 Advanced Features

### Custom Response Types

```typescript
class CustomResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;

  @ApiProperty({ example: { id: '123', name: 'Example' } })
  data: any;

  @ApiProperty({ example: 0 })
  error: number;
}

@ApiResponse({
  status: 200,
  description: 'Success response',
  type: CustomResponseDto
})
```

### File Upload Documentation

```typescript
@Post('upload')
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
      },
      description: {
        type: 'string',
      },
    },
  },
})
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  // file upload implementation
}
```

### Pagination Documentation

```typescript
class PaginationDto {
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 100, description: 'Total number of items' })
  total: number;

  @ApiProperty({ example: 10, description: 'Total number of pages' })
  totalPages: number;
}
```

## 🚀 Environment-Specific Configuration

### Development vs Production

```typescript
// In main.ts
const config = new DocumentBuilder()
  .setTitle('Alchemy Backend API')
  .setDescription('WhatsApp messaging backend API with multi-tenant support')
  .setVersion('1.0');

if (process.env.NODE_ENV === 'development') {
  config.addServer('http://localhost:3000', 'Development server');
} else {
  config.addServer('https://api.alchemy.com', 'Production server');
}
```

### Conditional Swagger Setup

```typescript
// Only enable Swagger in non-production environments
if (process.env.NODE_ENV !== 'production') {
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
```

## 📋 Checklist for New Endpoints

When adding a new endpoint, ensure you include:

- [ ] `@ApiOperation()` with summary and description
- [ ] `@ApiResponse()` for success cases
- [ ] `@ApiResponse()` for common error cases (400, 401, 403, 404, 500)
- [ ] `@ApiBearerAuth()` for protected endpoints
- [ ] `@ApiParam()` for path parameters
- [ ] `@ApiQuery()` for query parameters
- [ ] `@ApiBody()` for request body
- [ ] Proper DTO documentation with `@ApiProperty()`
- [ ] Realistic examples in all decorators
- [ ] Appropriate tags with `@ApiTags()`

## 🐛 Troubleshooting

### Common Issues

1. **Swagger UI not loading**: Check if the application is running and accessible at the correct URL
2. **Authorization not working**: Ensure the token format is correct (`Bearer <token>`)
3. **Schema not generating**: Verify DTO classes have proper `@ApiProperty()` decorators
4. **Missing endpoints**: Check if controllers are properly imported in modules

### Debug Tips

- Check browser console for JavaScript errors
- Verify network requests in browser developer tools
- Ensure all required decorators are imported from `@nestjs/swagger`
- Check that DTOs extend from classes, not interfaces

## 📚 Additional Resources

- [NestJS Swagger Documentation](https://docs.nestjs.com/openapi/introduction)
- [Swagger/OpenAPI Specification](https://swagger.io/specification/)
- [JSON Schema Documentation](https://json-schema.org/)

---

**Last Updated**: January 2025
**Version**: 1.0