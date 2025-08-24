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
      delete responseData.confidentialErrorMessage;
      return response.status(HttpStatus.UNAUTHORIZED).json(responseData);
    }
  }
}