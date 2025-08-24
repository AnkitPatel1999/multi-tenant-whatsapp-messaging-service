import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Create a mock ExecutionContext for testing guards
 */
export const createMockExecutionContext = (user: any = null, handler?: any, controller?: any): ExecutionContext => {
  const request = { user };
  
  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
      getResponse: jest.fn().mockReturnValue({}),
    }),
    getHandler: jest.fn().mockReturnValue(handler || jest.fn()),
    getClass: jest.fn().mockReturnValue(controller || jest.fn()),
    getArgs: jest.fn().mockReturnValue([]),
    getArgByIndex: jest.fn().mockReturnValue({}),
    switchToRpc: jest.fn().mockReturnValue({}),
    switchToWs: jest.fn().mockReturnValue({}),
    getType: jest.fn().mockReturnValue('http'),
  } as any;
};

/**
 * Create a mock Reflector for testing decorators
 */
export const createMockReflector = (): jest.Mocked<Reflector> => {
  return {
    get: jest.fn(),
    getAll: jest.fn(),
    getAllAndMerge: jest.fn(),
    getAllAndOverride: jest.fn(),
  } as any;
};

/**
 * Mock Mongoose model factory
 */
export const createMockMongooseModel = <T>(mockData?: T) => {
  return {
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockData ? [mockData] : []),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
    }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockData || null),
    }),
    findById: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockData || null),
    }),
    findByIdAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockData || null),
    }),
    findOneAndUpdate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockData || null),
    }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    save: jest.fn().mockResolvedValue(mockData),
    create: jest.fn().mockResolvedValue(mockData),
    constructor: jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, _id: 'generated-id' }),
      toObject: jest.fn().mockReturnValue(data),
    })),
  } as any;
};

/**
 * Create delay for testing async operations
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Assert that a function throws an error with specific message
 */
export const expectToThrow = async (
  asyncFn: () => Promise<any>,
  errorMessage?: string,
  errorType?: any
): Promise<void> => {
  try {
    await asyncFn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (errorType && !(error instanceof errorType)) {
      throw new Error(`Expected error of type ${errorType.name}, but got ${error.constructor.name}`);
    }
    if (errorMessage && error.message !== errorMessage) {
      throw new Error(`Expected error message "${errorMessage}", but got "${error.message}"`);
    }
  }
};

/**
 * Mock logger for testing
 */
export const createMockLogger = () => {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
};

/**
 * Mock JWT service for testing
 */
export const createMockJwtService = () => {
  return {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
    signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
    verify: jest.fn().mockReturnValue({ userId: '123', username: 'test' }),
    verifyAsync: jest.fn().mockResolvedValue({ userId: '123', username: 'test' }),
    decode: jest.fn().mockReturnValue({ userId: '123', username: 'test' }),
  };
};

/**
 * Mock cache service for testing
 */
export const createMockCacheService = () => {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    ttl: jest.fn().mockResolvedValue(-1),
  };
};

/**
 * Mock configuration service for testing
 */
export const createMockConfigService = () => {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        DATABASE_URL: 'mongodb://localhost:27017/test',
        REDIS_URL: 'redis://localhost:6379',
        NODE_ENV: 'test',
      };
      return config[key];
    }),
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        DATABASE_URL: 'mongodb://localhost:27017/test',
      };
      return config[key];
    }),
  };
};

/**
 * Generate test data arrays
 */
export const generateTestArray = <T>(factory: () => T, count: number): T[] => {
  return Array.from({ length: count }, factory);
};

/**
 * Test performance helper
 */
export const measurePerformance = async (fn: () => Promise<any>): Promise<{ result: any; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
};

/**
 * Cleanup test resources
 */
export const cleanupAfterTest = (cleanupFn: () => Promise<void> | void) => {
  afterEach(async () => {
    await cleanupFn();
  });
};
