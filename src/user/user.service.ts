import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schema/user.schema';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, CreateUserData } from '../dto/create-user.dto';


@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async createUser(createUserDto: CreateUserData): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await new this.userModel({
      userId: uuidv4(),
      ...createUserDto,
      password: hashedPassword
    });
    return user.save();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({ username }).exec();
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return await this.userModel.findOne({ userId }).exec();
  }

  async getAllUsers(tenantId?: string): Promise<UserDocument[]> {
    const filter: any = {};
    if (tenantId) filter.tenantId = tenantId;

    const usersData = await this.userModel.find(filter);
    if (!usersData || usersData.length === 0) {
      throw new NotFoundException('Users not found!');
    }
    return usersData;
  }

  async assignUserToGroup(userId: string, groupId: string, tenantId: string): Promise<UserDocument> {
    const user = await this.userModel.findOneAndUpdate(
      { userId, tenantId },
      { groupId },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteUser(userId: string, tenantId: string): Promise<{ success: boolean }> {
    const result = await this.userModel.deleteOne({ userId, tenantId });
    
    if (result.deletedCount === 0) {
      throw new NotFoundException('User not found');
    }

    return { success: true };
  }
}