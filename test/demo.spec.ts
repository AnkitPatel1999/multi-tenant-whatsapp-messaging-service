/**
 * Demonstration test file to show that our testing infrastructure works
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createMockUser, createMockAdminUser } from './factories/user.factory';
import { createMockExecutionContext, createMockJwtService } from './helpers/test-helpers';

describe('Testing Infrastructure Demo', () => {
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: JwtService,
          useValue: createMockJwtService(),
        },
      ],
    }).compile();

    jwtService = module.get(JwtService);
  });

  describe('Factory Functions', () => {
    it('should create mock user with default values', () => {
      const user = createMockUser();
      
      expect(user).toMatchObject({
        userId: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        isAdmin: false,
        isActive: true,
      });
    });

    it('should create mock admin user', () => {
      const adminUser = createMockAdminUser();
      
      expect(adminUser).toMatchObject({
        userId: 'admin123',
        username: 'adminuser',
        isAdmin: true,
      });
      expect(adminUser.permissions).toContain('system_admin');
    });

    it('should allow overrides in factory functions', () => {
      const customUser = createMockUser({
        username: 'customuser',
        isActive: false,
      });
      
      expect(customUser.username).toBe('customuser');
      expect(customUser.isActive).toBe(false);
    });
  });

  describe('Test Helpers', () => {
    it('should create mock execution context', () => {
      const user = createMockUser();
      const context = createMockExecutionContext(user);
      
      const request = context.switchToHttp().getRequest();
      expect(request.user).toBe(user);
    });

    it('should create mock JWT service', () => {
      const mockJwt = createMockJwtService();
      
      expect(mockJwt.sign('payload')).toBe('mock.jwt.token');
      expect(mockJwt.verify('token')).toMatchObject({
        userId: '123',
        username: 'test',
      });
    });
  });

  describe('JWT Service Integration', () => {
    it('should work with mocked JWT service', () => {
      jwtService.sign.mockReturnValue('test-token');
      
      const token = jwtService.sign({ userId: '123' });
      
      expect(token).toBe('test-token');
      expect(jwtService.sign).toHaveBeenCalledWith({ userId: '123' });
    });
  });

  describe('Async Operations', () => {
    it('should handle async operations correctly', async () => {
      const mockPromise = Promise.resolve('async-result');
      
      const result = await mockPromise;
      
      expect(result).toBe('async-result');
    });

    it('should handle promise rejections', async () => {
      const mockError = new Error('Test error');
      const mockPromise = Promise.reject(mockError);
      
      await expect(mockPromise).rejects.toThrow('Test error');
    });
  });

  describe('Custom Matchers', () => {
    it('should use custom date matcher', () => {
      const testDate = new Date();
      const invalidDate = new Date('invalid');
      
      expect(testDate).toBeValidDate();
      expect(invalidDate).not.toBeValidDate();
    });

    it('should use custom ObjectId matcher', () => {
      const validObjectId = '6422514a4665456789012345';
      const invalidObjectId = 'invalid-id';
      
      expect(validObjectId).toBeValidObjectId();
      expect(invalidObjectId).not.toBeValidObjectId();
    });
  });
});
