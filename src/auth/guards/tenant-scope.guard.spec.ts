import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantScopeGuard } from './tenant-scope.guard';
import { TENANT_SCOPE_KEY } from '../decorators/tenant-scope.decorator';

describe('TenantScopeGuard', () => {
  let guard: TenantScopeGuard;
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
        TenantScopeGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<TenantScopeGuard>(TenantScopeGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when tenant scope is not required', () => {
      // Arrange
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        TENANT_SCOPE_KEY,
        [context.getHandler(), context.getClass()],
      );
    });

    it('should return true when tenant scope requirement is undefined', () => {
      // Arrange
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        TENANT_SCOPE_KEY,
        [context.getHandler(), context.getClass()],
      );
    });

    it('should return true when tenant scope requirement is null', () => {
      // Arrange
      const context = createMockContext();
      reflector.getAllAndOverride.mockReturnValue(null);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when user has valid tenant ID', () => {
      // Arrange
      const userWithTenant = {
        userId: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
      };
      const context = createMockContext(userWithTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      // Arrange
      const context = createMockContext(null);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should throw ForbiddenException when user is undefined', () => {
      // Arrange
      const context = createMockContext(undefined);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should throw ForbiddenException when user has no tenantId', () => {
      // Arrange
      const userWithoutTenant = {
        userId: 'user123',
        username: 'testuser',
        groupId: 'group123',
        isAdmin: false,
        // No tenantId
      };
      const context = createMockContext(userWithoutTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should throw ForbiddenException when user has null tenantId', () => {
      // Arrange
      const userWithNullTenant = {
        userId: 'user123',
        username: 'testuser',
        tenantId: null,
        groupId: 'group123',
        isAdmin: false,
      };
      const context = createMockContext(userWithNullTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should throw ForbiddenException when user has empty string tenantId', () => {
      // Arrange
      const userWithEmptyTenant = {
        userId: 'user123',
        username: 'testuser',
        tenantId: '',
        groupId: 'group123',
        isAdmin: false,
      };
      const context = createMockContext(userWithEmptyTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should return true for admin user with valid tenantId', () => {
      // Arrange
      const adminUserWithTenant = {
        userId: 'admin123',
        username: 'adminuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: true,
      };
      const context = createMockContext(adminUserWithTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException for admin user without tenantId', () => {
      // Arrange
      const adminUserWithoutTenant = {
        userId: 'admin123',
        username: 'adminuser',
        groupId: 'group123',
        isAdmin: true,
        // No tenantId - even admins need tenant scope
      };
      const context = createMockContext(adminUserWithoutTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should return true when user has numeric tenantId', () => {
      // Arrange
      const userWithNumericTenant = {
        userId: 'user123',
        username: 'testuser',
        tenantId: 12345, // Numeric tenant ID
        groupId: 'group123',
        isAdmin: false,
      };
      const context = createMockContext(userWithNumericTenant);
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should work with different truthy values for tenantId', () => {
      // Arrange - Test with different truthy values
      const truthyTenantIds = ['tenant123', 123, true, {}, []];
      
      truthyTenantIds.forEach((tenantId) => {
        const userWithTruthy = {
          userId: 'user123',
          username: 'testuser',
          tenantId,
          groupId: 'group123',
          isAdmin: false,
        };
        const context = createMockContext(userWithTruthy);
        reflector.getAllAndOverride.mockReturnValue(true);

        // Act
        const result = guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
      });
    });

    it('should throw ForbiddenException with different falsy values for tenantId', () => {
      // Arrange - Test with different falsy values
      const falsyTenantIds = [null, undefined, '', 0, false, NaN];
      
      falsyTenantIds.forEach((tenantId) => {
        const userWithFalsy = {
          userId: 'user123',
          username: 'testuser',
          tenantId,
          groupId: 'group123',
          isAdmin: false,
        };
        const context = createMockContext(userWithFalsy);
        reflector.getAllAndOverride.mockReturnValue(true);

        // Act & Assert
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
        
        // Clear mocks for next iteration
        jest.clearAllMocks();
        reflector.getAllAndOverride.mockReturnValue(true);
      });
    });

    it('should correctly call reflector with proper parameters', () => {
      // Arrange
      const context = createMockContext();
      const mockHandler = jest.fn();
      const mockClass = jest.fn();
      
      // Override the context methods to return our mock functions
      context.getHandler = jest.fn().mockReturnValue(mockHandler);
      context.getClass = jest.fn().mockReturnValue(mockClass);
      
      reflector.getAllAndOverride.mockReturnValue(false);

      // Act
      guard.canActivate(context);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        TENANT_SCOPE_KEY,
        [mockHandler, mockClass],
      );
    });

    it('should handle reflector throwing an error', () => {
      // Arrange
      const context = createMockContext();
      reflector.getAllAndOverride.mockImplementation(() => {
        throw new Error('Reflector error');
      });

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow('Reflector error');
    });

    it('should handle context.switchToHttp throwing an error', () => {
      // Arrange
      const brokenContext = {
        switchToHttp: jest.fn().mockImplementation(() => {
          throw new Error('Context switch error');
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;
      
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(brokenContext)).toThrow('Context switch error');
    });

    it('should handle request.getRequest throwing an error', () => {
      // Arrange
      const contextWithBrokenRequest = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockImplementation(() => {
            throw new Error('Request error');
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;
      
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(contextWithBrokenRequest)).toThrow('Request error');
    });

    it('should handle request without user property', () => {
      // Arrange
      const requestWithoutUser = {};
      const contextWithEmptyRequest = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithoutUser),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;
      
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(contextWithEmptyRequest)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(contextWithEmptyRequest)).toThrow('Tenant scope required');
    });
  });

  describe('integration tests', () => {
    it('should work correctly in a typical request flow', () => {
      // Arrange - Simulate a typical authenticated request
      const authenticatedUser = {
        userId: 'user123',
        username: 'testuser',
        tenantId: 'tenant123',
        groupId: 'group123',
        isAdmin: false,
      };
      const context = createMockContext(authenticatedUser);
      
      // Simulate method requires tenant scope
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1);
    });

    it('should block requests without tenant scope when required', () => {
      // Arrange - Simulate request without tenant info
      const userWithoutTenant = {
        userId: 'user123',
        username: 'testuser',
        // Missing tenantId
      };
      const context = createMockContext(userWithoutTenant);
      
      // Simulate method requires tenant scope
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act & Assert
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Tenant scope required');
    });

    it('should allow requests to methods that do not require tenant scope', () => {
      // Arrange - Any user (even without tenant)
      const anyUser = {
        userId: 'user123',
        username: 'testuser',
      };
      const context = createMockContext(anyUser);
      
      // Simulate method does NOT require tenant scope
      reflector.getAllAndOverride.mockReturnValue(false);

      // Act
      const result = guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('decorator integration', () => {
    it('should work with TENANT_SCOPE_KEY constant', () => {
      // This test ensures the guard is using the correct decorator key
      expect(TENANT_SCOPE_KEY).toBeDefined();
      expect(typeof TENANT_SCOPE_KEY).toBe('string');
    });
  });

  describe('error message consistency', () => {
    it('should always throw the same error message for different failure cases', () => {
      const context1 = createMockContext(null);
      const context2 = createMockContext(undefined);
      const context3 = createMockContext({ userId: 'user123' }); // No tenantId
      const context4 = createMockContext({ userId: 'user123', tenantId: null });
      const context5 = createMockContext({ userId: 'user123', tenantId: '' });
      
      reflector.getAllAndOverride.mockReturnValue(true);

      const contexts = [context1, context2, context3, context4, context5];
      
      contexts.forEach((context, index) => {
        try {
          guard.canActivate(context);
          fail(`Expected context ${index} to throw ForbiddenException`);
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.message).toBe('Tenant scope required');
        }
        
        // Reset mock for next iteration
        jest.clearAllMocks();
        reflector.getAllAndOverride.mockReturnValue(true);
      });
    });
  });
});
