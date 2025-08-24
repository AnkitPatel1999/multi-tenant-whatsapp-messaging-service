import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Delete, Res, Req, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { PermissionGuard, RequirePermissions } from '../auth/guards/permission.guard';
import { CreateUserDto, CreateUserData } from '../dto/create-user.dto';
import { PERMISSIONS } from '../auth/constants/permissions';
import { AssignUserToGroupDto } from '../dto/assign-user-to-group.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CREATE_USER)
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
    @Body() body: AssignUserToGroupDto
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