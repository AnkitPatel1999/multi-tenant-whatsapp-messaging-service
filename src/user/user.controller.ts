import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Delete, Res, Req, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
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
    description: 'Create a new user account within the authenticated tenant with specified role and permissions'
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User creation data',
    examples: {
      adminUser: {
        summary: 'Admin user example',
        value: {
          username: 'admin.user',
          password: 'SecureAdminPass123!',
          groupId: '507f1f77bcf86cd799439011',
          email: 'admin@company.com',
          phoneNumber: '+1234567890',
          name: 'Admin User',
          isAdmin: true,
          isActive: true
        }
      },
      regularUser: {
        summary: 'Regular user example',
        value: {
          username: 'john.smith',
          password: 'UserPassword456!',
          groupId: '507f1f77bcf86cd799439012',
          email: 'john.smith@company.com',
          phoneNumber: '+1987654321',
          name: 'John Smith',
          isAdmin: false,
          isActive: true
        }
      },
      minimalUser: {
        summary: 'Minimal user (required fields only)',
        value: {
          username: 'minimal.user',
          password: 'MinimalPass789!',
          groupId: '507f1f77bcf86cd799439013'
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
            id: { type: 'string', example: '507f1f77bcf86cd799439014' },
            username: { type: 'string', example: 'john.smith' },
            email: { type: 'string', example: 'john.smith@company.com' },
            name: { type: 'string', example: 'John Smith' },
            phoneNumber: { type: 'string', example: '+1987654321' },
            groupId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            tenantId: { type: 'string', example: '507f1f77bcf86cd799439015' },
            isAdmin: { type: 'boolean', example: false },
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
    description: 'Bad Request - Invalid user data or validation errors',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: User not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { 
          type: 'string', 
          example: 'Username must be at least 3 characters long' 
        }
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
  @ApiResponse({
    status: 409,
    description: 'Conflict - Username or email already exists',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Error: User not created!' },
        data: { type: 'object', example: {} },
        error: { type: 'number', example: 1 },
        confidentialErrorMessage: { 
          type: 'string', 
          example: 'Username john.smith already exists in tenant' 
        }
      }
    }
  })
  async createUser(@Req() request, @Res() response, @Body() createUserDto: CreateUserDto) {
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
      const userData: CreateUserData = {
        ...createUserDto,
        tenantId: request.user.tenantId,
      };
      const user = await this.userService.createUser(userData);
      responseData.message = 'User has been created successfully';
      responseData.data = user;
      return response.status(HttpStatus.CREATED).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: User not created!';
      responseData.confidentialErrorMessage = err.message;
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
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
              id: { type: 'string', example: '507f1f77bcf86cd799439014' },
              username: { type: 'string', example: 'john.smith' },
              email: { type: 'string', example: 'john.smith@company.com' },
              name: { type: 'string', example: 'John Smith' },
              phoneNumber: { type: 'string', example: '+1987654321' },
              groupId: { type: 'string', example: '507f1f77bcf86cd799439012' },
              isAdmin: { type: 'boolean', example: false },
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
    status: 403,
    description: 'Forbidden - Insufficient permissions to view users'
  })
  async getAllUsers(@Req() request, @Res() response) {
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
      const users = await this.userService.getAllUsers(request.user.tenantId);
      responseData.message = 'Users retrieved successfully';
      responseData.data = users;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve users!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
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
    example: '507f1f77bcf86cd799439014'
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439014' },
            username: { type: 'string', example: 'john.smith' },
            email: { type: 'string', example: 'john.smith@company.com' },
            name: { type: 'string', example: 'John Smith' },
            phoneNumber: { type: 'string', example: '+1987654321' },
            groupId: { type: 'string', example: '507f1f77bcf86cd799439012' },
            isAdmin: { type: 'boolean', example: false },
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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions to view users'
  })
  async getUserById(@Req() request, @Res() response, @Param('userId') userId: string) {
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
      const user = await this.userService.findById(userId);
      if(!user) {
        responseData.error = 1;
        responseData.message = 'User not found';
        return response.status(HttpStatus.NOT_FOUND).json(responseData);
      }
      responseData.message = 'User retrieved successfully';
      responseData.data = user;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to retrieve user!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Put(':userId/group')
  @RequirePermissions(PERMISSIONS.ASSIGN_USERS_TO_GROUPS)
  async assignUserToGroup(
    @Req() request,
    @Res() response,
    @Param('userId') userId: string,
    @Body() body: { groupId: string }
  ) {
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
      const user = await this.userService.assignUserToGroup(userId, body.groupId, request.user.tenantId);
      responseData.message = 'User assigned to group successfully';
      responseData.data = user;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to assign user to group!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }

  @Delete(':userId')
  @RequirePermissions(PERMISSIONS.DELETE_USER)
  async deleteUser(@Req() request, @Res() response, @Param('userId') userId: string) {
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
      const result = await this.userService.deleteUser(userId, request.user.tenantId);
      responseData.message = 'User deleted successfully';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Failed to delete user!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.BAD_REQUEST).json(responseData);
    }
  }
}