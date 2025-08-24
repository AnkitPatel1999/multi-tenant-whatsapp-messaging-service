import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Delete, Res, Req, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantScope } from '../auth/decorators/tenant-scope.decorator';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { PermissionGuard, RequirePermissions } from '../auth/guards/permission.guard';
import { CreateUserDto, CreateUserData } from '../dto/create-user.dto';
import { PERMISSIONS } from '../auth/constants/permissions';

@Controller('users')
@UseGuards(JwtAuthGuard, TenantScopeGuard, PermissionGuard)
@TenantScope()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CREATE_USER)
  async createUser(@Req() request, @Res() response, @Body() createUserDto: CreateUserDto) {
    try {
      const userData: CreateUserData = {
        ...createUserDto,
        tenantId: request.user.tenantId,
      };
      const user = await this.userService.createUser(userData);
      return response.status(HttpStatus.CREATED).json({
        message: 'User has been created successfully',
        user
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: 'Error: User not created!',
          error: 'Bad Request',
          confidentialErrorMessage: err.message
      });
    }
  }

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getAllUsers(@Req() request, @Res() response) {
    try {
      const users = await this.userService.getAllUsers(request.user.tenantId);
      return response.status(HttpStatus.OK).json({
        message: 'Users retrieved successfully',
        users
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to retrieve users!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Get(':userId')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  async getUserById(@Param('userId') userId: string) {
    const user = await this.userService.findById(userId);
    return {
      message: 'User retrieved successfully',
      user
    };
  }

  @Put(':userId/group')
  @RequirePermissions(PERMISSIONS.ASSIGN_USERS_TO_GROUPS)
  async assignUserToGroup(
    @Req() request,
    @Res() response,
    @Param('userId') userId: string,
    @Body() body: { groupId: string }
  ) {
    try {
      const user = await this.userService.assignUserToGroup(userId, body.groupId, request.user.tenantId);
      return response.status(HttpStatus.OK).json({
        message: 'User assigned to group successfully',
        user
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to assign user to group!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }

  @Delete(':userId')
  @RequirePermissions(PERMISSIONS.DELETE_USER)
  async deleteUser(@Req() request, @Res() response, @Param('userId') userId: string) {
    try {
      const result = await this.userService.deleteUser(userId, request.user.tenantId);
      return response.status(HttpStatus.OK).json({
        message: 'User deleted successfully',
        ...result
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Error: Failed to delete user!',
        error: 'Bad Request',
        confidentialErrorMessage: err.message
      });
    }
  }
}