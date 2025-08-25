import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserDocument } from '../schema/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      // Convert Mongoose document to plain object and remove password
      const userObject = user.toObject ? user.toObject() : user;
      const { password, ...result } = userObject;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.userId, 
      tenantId: user.tenantId,
      groupId: user.groupId,
      isAdmin: user.isAdmin 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user.userId,
        email: user.email,
        tenantId: user.tenantId,
        groupId: user.groupId,
        isAdmin: user.isAdmin,
      },
    };
  }
}