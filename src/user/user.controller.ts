import { Controller, HttpStatus, Res } from '@nestjs/common';
import { Body, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from 'src/dto/create.user.dto';


@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post()
    async createUser(@Res() response, @Body() createUserDto: CreateUserDto) {
        try {
            const user = await this.userService.createUser(createUserDto);
            return response.status(HttpStatus.CREATED).json({
                message: 'User created successfully',
                user,
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                statusCode: 400,
                message: 'Error creating user1',
                error: error.message,
            });
        }
    }

    @Get()
    async getAllUsers(@Res() response) {
        try {
            const users = await this.userService.getAllUsers();
            return response.status(HttpStatus.OK).json({
                message: "Users found successfully",
                users
            });
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).json({
                statusCode: 400,
                message: 'Error on getting users',
                error: error.message,
            });
        }
    }
}