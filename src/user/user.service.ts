import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from 'src/dto/create.user.dto';
import { User } from 'src/schema/user.schema';

@Injectable()
export class UserService {

    private userModel: Model<User>;

    constructor(@InjectModel('User') userModel: Model<User>) {
        this.userModel = userModel;
    }

    async createUser(createUserDto: CreateUserDto): Promise<User> {
        const createdUser = await new this.userModel(createUserDto);
        return createdUser.save();
    }

    async getAllUsers(): Promise<User[]> {
        const usersData = await this.userModel.find();
        if(!usersData || usersData.length == 0) {   
            throw new NotFoundException("Users not found!");
        }
        return usersData;
    }

}
