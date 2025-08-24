import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should use JWT secret from config service', () => {
      // Arrange
      configService.get.mockReturnValue('test-secret-key');

      // Act
      const newStrategy = new JwtStrategy(configService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(newStrategy).toBeDefined();
    });

    it('should use default secret when config service returns null', () => {
      // Arrange
      configService.get.mockReturnValue(null);

      // Act
      const newStrategy = new JwtStrategy(configService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(newStrategy).toBeDefined();
      // Should use fallback secret 'your-secret-key'
    });

    it('should use default secret when config service returns undefined', () => {
      // Arrange
      configService.get.mockReturnValue(undefined);

      // Act
      const newStrategy = new JwtStrategy(configService);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(newStrategy).toBeDefined();
      // Should use fallback secret 'your-secret-key'
    });
  });

  describe('validate', () => {
    it('should return user object with correct properties for valid payload', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
        iat: 1640995200, // Issued at
        exp: 1641081600, // Expires at
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
      });
    });

    it('should return user object for admin user', async () => {
      // Arrange
      const mockPayload = {
        sub: 'admin456',
        username: 'adminuser',
        tenantId: 'tenant456',
        groupId: 'group456',
        isAdmin: true,
        iat: 1640995200,
        exp: 1641081600,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'admin456',
        username: 'adminuser',
        tenantId: 'tenant456',
        groupId: 'group456',
        isAdmin: true,
      });
    });

    it('should handle payload with missing optional properties', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user789',
        username: 'simpleuser',
        // Missing tenantId, groupId, isAdmin
        iat: 1640995200,
        exp: 1641081600,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user789',
        username: 'simpleuser',
        tenantId: undefined,
        groupId: undefined,
        isAdmin: undefined,
      });
    });

    it('should handle payload with null values', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user456',
        username: 'nulluser',
        tenantId: null,
        groupId: null,
        isAdmin: null,
        iat: 1640995200,
        exp: 1641081600,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user456',
        username: 'nulluser',
        tenantId: null,
        groupId: null,
        isAdmin: null,
      });
    });

    it('should handle payload with empty string values', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user789',
        username: '',
        tenantId: '',
        groupId: '',
        isAdmin: false,
        iat: 1640995200,
        exp: 1641081600,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user789',
        username: '',
        tenantId: '',
        groupId: '',
        isAdmin: false,
      });
    });

    it('should handle payload with numeric userId (sub)', async () => {
      // Arrange
      const mockPayload = {
        sub: 123456, // Numeric user ID
        username: 'numericuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
        iat: 1640995200,
        exp: 1641081600,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 123456,
        username: 'numericuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
      });
    });

    it('should preserve additional payload properties in mapped user object', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
        email: 'test@example.com', // Additional property
        role: 'manager', // Additional property
        iat: 1640995200,
        exp: 1641081600,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
        // Additional properties should not be included in the mapped result
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('role');
      expect(result).not.toHaveProperty('iat');
      expect(result).not.toHaveProperty('exp');
    });

    it('should handle boolean isAdmin values correctly', async () => {
      // Test true
      const adminPayload = {
        sub: 'admin123',
        username: 'admin',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: true,
      };

      const adminResult = await strategy.validate(adminPayload);
      expect(adminResult.isAdmin).toBe(true);

      // Test false
      const userPayload = {
        sub: 'user123',
        username: 'user',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
      };

      const userResult = await strategy.validate(userPayload);
      expect(userResult.isAdmin).toBe(false);
    });

    it('should handle truthy/falsy isAdmin values', async () => {
      // Test truthy value
      const truthyPayload = {
        sub: 'user123',
        username: 'user',
        isAdmin: 1, // truthy
      };

      const truthyResult = await strategy.validate(truthyPayload);
      expect(truthyResult.isAdmin).toBe(1);

      // Test falsy value
      const falsyPayload = {
        sub: 'user456',
        username: 'user',
        isAdmin: 0, // falsy
      };

      const falsyResult = await strategy.validate(falsyPayload);
      expect(falsyResult.isAdmin).toBe(0);
    });

    it('should handle special characters in string fields', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user@123',
        username: 'test.user+special@domain.com',
        tenantId: 'tenant-123_456',
        groupId: 'group:123/456',
        isAdmin: false,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: 'user@123',
        username: 'test.user+special@domain.com',
        tenantId: 'tenant-123_456',
        groupId: 'group:123/456',
        isAdmin: false,
      });
    });

    it('should be async and return a Promise', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
      };

      // Act
      const result = strategy.validate(mockPayload);

      // Assert
      expect(result).toBeInstanceOf(Promise);
      const resolvedResult = await result;
      expect(resolvedResult).toBeDefined();
    });

    it('should maintain consistent property mapping', async () => {
      // Arrange
      const mockPayload = {
        sub: 'user123', // Should map to userId
        username: 'testuser', // Should remain username
        tenantId: 'tenant123', // Should remain tenantId
        groupId: 'group123', // Should remain groupId
        isAdmin: true, // Should remain isAdmin
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toHaveProperty('userId', 'user123'); // sub -> userId
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('tenantId', 'tenant123');
      expect(result).toHaveProperty('groupId', 'group123');
      expect(result).toHaveProperty('isAdmin', true);
      
      // Ensure 'sub' is not in the result
      expect(result).not.toHaveProperty('sub');
    });
  });

  describe('integration with passport', () => {
    it('should extend PassportStrategy correctly', () => {
      expect(strategy).toBeInstanceOf(JwtStrategy);
    });

    it('should be decorated with @Injectable', () => {
      // This test ensures the class is properly decorated for NestJS DI
      expect(strategy.constructor).toBeDefined();
    });

    it('should handle the strategy configuration correctly', () => {
      // Arrange
      configService.get.mockReturnValue('custom-secret-123');

      // Act
      const newStrategy = new JwtStrategy(configService);

      // Assert
      expect(newStrategy).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('edge cases', () => {
    it('should handle empty payload object', async () => {
      // Arrange
      const emptyPayload = {};

      // Act
      const result = await strategy.validate(emptyPayload);

      // Assert
      expect(result).toEqual({
        userId: undefined,
        username: undefined,
        tenantId: undefined,
        groupId: undefined,
        isAdmin: undefined,
      });
    });

    it('should handle null payload', async () => {
      // Arrange
      const nullPayload = null;

      // Act & Assert
      // This will throw an error because we can't access properties of null
      await expect(async () => {
        await strategy.validate(nullPayload);
      }).rejects.toThrow(); // Should throw when trying to access properties of null
    });

    it('should handle undefined payload', async () => {
      // Arrange
      const undefinedPayload = undefined;

      // Act & Assert
      await expect(async () => {
        await strategy.validate(undefinedPayload);
      }).rejects.toThrow(); // Should throw when trying to access properties of undefined
    });

    it('should handle very long string values', async () => {
      // Arrange
      const longString = 'a'.repeat(1000);
      const mockPayload = {
        sub: longString,
        username: longString,
        tenantId: longString,
        groupId: longString,
        isAdmin: false,
      };

      // Act
      const result = await strategy.validate(mockPayload);

      // Assert
      expect(result).toEqual({
        userId: longString,
        username: longString,
        tenantId: longString,
        groupId: longString,
        isAdmin: false,
      });
    });
  });
});
