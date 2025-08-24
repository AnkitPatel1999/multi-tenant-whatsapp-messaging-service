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
      const result = await this.authService.login(request.user);
      responseData.message = 'Login successful';
      responseData.data = result;
      return response.status(HttpStatus.OK).json(responseData);
    } catch (err) {
      responseData.error = 1;
      responseData.message = 'Error: Login failed!';
      responseData.confidentialErrorMessage = err.message;
      
      return response.status(HttpStatus.UNAUTHORIZED).json(responseData);
    }
  }
}