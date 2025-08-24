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
        message: 'user has been created successfully',
        user
      });
    } catch (err) {
      return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: 'Error: user not created!',
          error: 'Bad Request',
          confidentialErrorMessage: err.message
      });
    }
  }


  // @Post()
  // @RequirePermissions(PERMISSIONS.CREATE_USER)
  // // Create a new user (Admin only)
  // async createUser(@Request()  req, @Body() createUserDto: CreateUserDto) {
  //   try {
  //     console.log("request ",req.user)
  //     console.log("createUserDto ",createUserDto)
  //     return this.userService.createUser({
  //       ...createUserDto,
  //       tenantId: req.user.tenantId,
  //     });
  //   } catch (error) {
  //     // return
  //   }
  // }

  @Get()
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  // Get all users for the tenant
  async getAllUsers(@Request() req) {
    return this.userService.getAllUsers(req.user.tenantId);
  }

  @Get(':userId')
  @RequirePermissions(PERMISSIONS.VIEW_LOGS)
  // Get user by ID
  async getUserById(@Request() req, @Param('userId') userId: string) {
    return this.userService.findById(userId);
  }

  @Put(':userId/group')
  @RequirePermissions(PERMISSIONS.ASSIGN_USERS_TO_GROUPS)
  // Assign user to a group (Admin only)
  async assignUserToGroup(
    @Request() req,
    @Param('userId') userId: string,
    @Body() body: { groupId: string }
  ) {
    return this.userService.assignUserToGroup(userId, body.groupId, req.user.tenantId);
  }

  @Delete(':userId')
  @RequirePermissions(PERMISSIONS.DELETE_USER)
  // Delete a user (Admin only)
  async deleteUser(@Request() req, @Param('userId') userId: string) {
    return this.userService.deleteUser(userId, req.user.tenantId);
  }
}