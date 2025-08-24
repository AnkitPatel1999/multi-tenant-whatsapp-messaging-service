import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { User } from '../schema/user.schema';

describe('UserService', () => {
  let service: UserService;
  let userModel: any;

  beforeEach(async () => {
    // Create a constructor function that acts as a Mongoose model
    const mockUserModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data)
    }));
    
    // Add static methods to the constructor function
    mockUserModel.findOne = jest.fn();
    mockUserModel.find = jest.fn();
    mockUserModel.findOneAndUpdate = jest.fn();
    mockUserModel.deleteOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userModel = module.get(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
