import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let authService: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    _id: '6422514a4665456789012345',
    userId: 'user123',
    username: 'testuser',
    password: '$2b$10$hashedpassword',
    tenantId: 'tenant123',
    groupId: 'group123',
    isAdmin: false,
    email: 'test@example.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    toObject: jest.fn().mockReturnThis(),
  };

  const mockUserPlain = {
    _id: '6422514a4665456789012345',
    userId: 'user123',
    username: 'testuser',
    tenantId: 'tenant123',
    groupId: 'group123',
    isAdmin: false,
    email: 'test@example.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByUsername: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'validpassword';
      
      userService.findByUsername.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockUser.toObject.mockReturnValue(mockUserPlain);

      // Act
      const result = await authService.validateUser(username, password);

      // Assert
      expect(result).toEqual(mockUserPlain);
      expect(userService.findByUsername).toHaveBeenCalledWith(username);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result.password).toBeUndefined();
    });

    it('should return null when user is not found', async () => {
      // Arrange
      const username = 'nonexistentuser';
      const password = 'anypassword';
      
      userService.findByUsername.mockResolvedValue(null);

      // Act
      const result = await authService.validateUser(username, password);

      // Assert
      expect(result).toBeNull();
      expect(userService.findByUsername).toHaveBeenCalledWith(username);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is invalid', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'wrongpassword';
      
      userService.findByUsername.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act
      const result = await authService.validateUser(username, password);

      // Assert
      expect(result).toBeNull();
      expect(userService.findByUsername).toHaveBeenCalledWith(username);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
    });

    it('should handle user without toObject method', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'validpassword';
      const plainUser = { ...mockUserPlain, password: '$2b$10$hashedpassword' };
      
      userService.findByUsername.mockResolvedValue(plainUser as any);
      mockedBcrypt.compare.mockResolvedValue(true);

      // Act
      const result = await authService.validateUser(username, password);

      // Assert
      expect(result).toEqual(mockUserPlain);
      expect(result.password).toBeUndefined();
    });

    it('should handle bcrypt comparison errors gracefully', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'anypassword';
      
      userService.findByUsername.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      // Act & Assert
      await expect(authService.validateUser(username, password)).rejects.toThrow('Bcrypt error');
      expect(userService.findByUsername).toHaveBeenCalledWith(username);
    });
  });

  describe('login', () => {
    it('should generate JWT token and return user data for valid user', async () => {
      // Arrange
      const user = mockUserPlain;
      const expectedToken = 'jwt.token.here';
      const expectedPayload = {
        username: user.username,
        sub: user.userId,
        tenantId: user.tenantId,
        groupId: user.groupId,
        isAdmin: user.isAdmin,
      };
      
      jwtService.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authService.login(user);

      // Assert
      expect(result).toEqual({
        access_token: expectedToken,
        user: {
          userId: user.userId,
          username: user.username,
          tenantId: user.tenantId,
          groupId: user.groupId,
          isAdmin: user.isAdmin,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
    });

    it('should handle admin users correctly', async () => {
      // Arrange
      const adminUser = { ...mockUserPlain, isAdmin: true };
      const expectedToken = 'admin.jwt.token';
      
      jwtService.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authService.login(adminUser);

      // Assert
      expect(result.user.isAdmin).toBe(true);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ isAdmin: true })
      );
    });

    it('should handle users without optional fields', async () => {
      // Arrange
      const minimalUser = {
        userId: 'user123',
        username: 'testuser',
        tenantId: undefined,
        groupId: undefined,
        isAdmin: false,
      };
      const expectedToken = 'minimal.jwt.token';
      
      jwtService.sign.mockReturnValue(expectedToken);

      // Act
      const result = await authService.login(minimalUser);

      // Assert
      expect(result).toEqual({
        access_token: expectedToken,
        user: {
          userId: minimalUser.userId,
          username: minimalUser.username,
          tenantId: undefined,
          groupId: undefined,
          isAdmin: false,
        },
      });
    });

    it('should propagate JWT service errors', async () => {
      // Arrange
      const user = mockUserPlain;
      jwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      // Act & Assert
      await expect(() => authService.login(user)).rejects.toThrow('JWT signing failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete authentication flow', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'validpassword';
      const expectedToken = 'complete.flow.token';
      
      userService.findByUsername.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockUser.toObject.mockReturnValue(mockUserPlain);
      jwtService.sign.mockReturnValue(expectedToken);

      // Act - Simulate full auth flow
      const validatedUser = await authService.validateUser(username, password);
      const loginResult = await authService.login(validatedUser);

      // Assert
      expect(validatedUser).toEqual(mockUserPlain);
      expect(loginResult.access_token).toBe(expectedToken);
      expect(loginResult.user.userId).toBe(mockUserPlain.userId);
    });

    it('should handle failed authentication flow', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'wrongpassword';
      
      userService.findByUsername.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act
      const validatedUser = await authService.validateUser(username, password);

      // Assert
      expect(validatedUser).toBeNull();
      // Should not proceed to login if validation fails
    });
  });
});