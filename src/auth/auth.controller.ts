import { Controller, Post, UseGuards, Request, Body, Res, Req, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from '../dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() request, @Res() response, @Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(request.user);
      return response.status(HttpStatus.OK).json({
        message: 'Login successful',
        ...result
      });
    } catch (err) {
      return response.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: 'Error: Login failed!',
        error: 'Unauthorized',
        confidentialErrorMessage: err.message
      });
    }
  }
}