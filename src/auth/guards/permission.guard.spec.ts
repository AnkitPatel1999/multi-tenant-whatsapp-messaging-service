import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard, PERMISSIONS_KEY, RequirePermissions } from './permission.guard';
import { PERMISSIONS } from '../constants/permissions';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;

  // Mock ExecutionContext
  const createMockContext = (user: any = null): ExecutionContext => {
    const request = {
      user,
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when no permissions are required', () => {
      // Arrange
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      );
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      // Arrange
      const context = createMockContext(null);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated or no group assigned');
    });

    it('should throw ForbiddenException when user has no groupId', () => {
      // Arrange
      const userWithoutGroup = {
        userId: 'user123',
        username: 'testuser',
        isAdmin: false,
        // No groupId
      };
      const context = createMockContext(userWithoutGroup);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated or no group assigned');
    });

    it('should return true when user is admin (bypass permission checks)', () => {
      // Arrange
      const adminUser = {
        userId: 'admin123',
        username: 'adminuser',
        groupId: 'group123',
        isAdmin: true,
        permissions: [], // No specific permissions
      };
      const context = createMockContext(adminUser);
      const requiredPermissions = [PERMISSIONS.SYSTEM_ADMIN, PERMISSIONS.MANAGE_USERS];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when user has required permission', () => {
      // Arrange
      const regularUser = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: [PERMISSIONS.SEND_MESSAGES, PERMISSIONS.VIEW_CONTACTS],
      };
      const context = createMockContext(regularUser);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when user has any of the required permissions', () => {
      // Arrange
      const regularUser = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: [PERMISSIONS.VIEW_CONTACTS],
      };
      const context = createMockContext(regularUser);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES, PERMISSIONS.VIEW_CONTACTS];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required permissions', () => {
      // Arrange
      const regularUser = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: [PERMISSIONS.VIEW_CONTACTS], // Only has view permissions
      };
      const context = createMockContext(regularUser);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES, PERMISSIONS.MANAGE_USERS];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions. Required: send_messages, manage_users'
      );
    });

    it('should handle user with no permissions array', () => {
      // Arrange
      const userWithoutPermissions = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        // No permissions property
      };
      const context = createMockContext(userWithoutPermissions);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions. Required: send_messages'
      );
    });

    it('should handle user with null permissions', () => {
      // Arrange
      const userWithNullPermissions = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: null,
      };
      const context = createMockContext(userWithNullPermissions);
      const requiredPermissions = [PERMISSIONS.SEND_MESSAGES];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Insufficient permissions. Required: send_messages'
      );
    });

    it('should work with single permission requirement', () => {
      // Arrange
      const regularUser = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: [PERMISSIONS.VIEW_LOGS],
      };
      const context = createMockContext(regularUser);
      const requiredPermissions = [PERMISSIONS.VIEW_LOGS];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle empty required permissions array', () => {
      // Arrange
      const regularUser = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: [PERMISSIONS.VIEW_LOGS],
      };
      const context = createMockContext(regularUser);
      const requiredPermissions = [];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act & Assert
      // Empty permissions array should throw because some() returns false for empty arrays
      // This is the actual behavior of the guard - if you want no permission checks, return undefined/null from reflector
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Insufficient permissions. Required:');
    });

    it('should handle case-sensitive permission matching', () => {
      // Arrange
      const regularUser = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        permissions: ['send_messages'], // Exact match required
      };
      const context = createMockContext(regularUser);
      const requiredPermissions = ['send_messages'];
      reflector.getAllAndOverride.mockReturnValue(requiredPermissions);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle reflector errors gracefully', () => {
      // Arrange
      const context = createMockContext();
      reflector.getAllAndOverride.mockImplementation(() => {
        throw new Error('Reflector error');
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow('Reflector error');
    });
  });

  describe('RequirePermissions Decorator', () => {
    it('should set metadata for required permissions', () => {
      // Arrange
      const permissions = [PERMISSIONS.SEND_MESSAGES, PERMISSIONS.VIEW_CONTACTS];
      const target = {};
      const key = 'testMethod';
      const descriptor = { value: jest.fn() };

      // Mock Reflect.defineMetadata
      const defineMetadataSpy = jest.spyOn(Reflect, 'defineMetadata');

      // Act
      RequirePermissions(...permissions)(target, key, descriptor);

      // Assert
      expect(defineMetadataSpy).toHaveBeenCalledWith(
        PERMISSIONS_KEY,
        permissions,
        descriptor.value
      );

      // Cleanup
      defineMetadataSpy.mockRestore();
    });

    it('should return the descriptor unchanged', () => {
      // Arrange
      const permissions = [PERMISSIONS.MANAGE_DEVICES];
      const target = {};
      const key = 'testMethod';
      const descriptor = { value: jest.fn() };

      // Act
      const result = RequirePermissions(...permissions)(target, key, descriptor);

      // Assert
      expect(result).toBe(descriptor);
    });

    it('should work with no permissions', () => {
      // Arrange
      const target = {};
      const key = 'testMethod';
      const descriptor = { value: jest.fn() };

      // Mock Reflect.defineMetadata
      const defineMetadataSpy = jest.spyOn(Reflect, 'defineMetadata');

      // Act
      RequirePermissions()(target, key, descriptor);

      // Assert
      expect(defineMetadataSpy).toHaveBeenCalledWith(
        PERMISSIONS_KEY,
        [],
        descriptor.value
      );

      // Cleanup
      defineMetadataSpy.mockRestore();
    });
  });
});
