// Global test setup
import 'reflect-metadata';

// Set test timeout
jest.setTimeout(30000);

// Setup test environment
afterEach(() => {
  jest.clearAllMocks();
});

// Mock process.env for consistent testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379/0';

// Global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidObjectId(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Date`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Date`,
        pass: false,
      };
    }
  },

  toBeValidObjectId(received) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    const pass = typeof received === 'string' && objectIdRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },
});
