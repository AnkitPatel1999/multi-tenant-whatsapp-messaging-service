import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schema/user.schema';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async createUser(createUserDto: any): Promise<UserDocument> {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
      
      const user = new this.userModel({
        userId: uuidv4(),
        ...createUserDto,
        password: hashedPassword,
      });

      return await user.save();
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ username }).exec();
    } catch (error) {
      this.logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  async findById(userId: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ userId }).exec();
    } catch (error) {
      this.logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async getAllUsers(tenantId?: string): Promise<UserDocument[]> {
    try {
      const filter: any = {};
      if (tenantId) filter.tenantId = tenantId;

      const usersData = await this.userModel.find(filter);
      if (!usersData || usersData.length === 0) {
        throw new NotFoundException('Users not found!');
      }
      return usersData;
    } catch (error) {
      this.logger.error('Error getting all users:', error);
      throw error;
    }
  }

  async assignUserToGroup(userId: string, groupId: string, tenantId: string): Promise<UserDocument> {
    try {
      const user = await this.userModel.findOneAndUpdate(
        { userId, tenantId },
        { groupId },
        { new: true }
      );

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      this.logger.error('Error assigning user to group:', error);
      throw error;
    }
  }

  async deleteUser(userId: string, tenantId: string): Promise<{ success: boolean }> {
    try {
      const result = await this.userModel.deleteOne({ userId, tenantId });
      
      if (result.deletedCount === 0) {
        throw new NotFoundException('User not found');
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      throw error;
    }
  }
}