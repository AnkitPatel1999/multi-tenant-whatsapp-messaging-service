import { UserDocument } from '../../src/schema/user.schema';

export interface MockUserData {
  _id?: string;
  userId?: string;
  username?: string;
  password?: string;
  email?: string;
  tenantId?: string;
  groupId?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create a mock user object for testing
 */
export const createMockUser = (overrides: MockUserData = {}): Partial<UserDocument> => {
  const defaults = {
    _id: '6422514a4665456789012345',
    userId: 'user123',
    username: 'testuser',
    password: '$2b$10$hashedpassword123456',
    email: 'test@example.com',
    tenantId: 'tenant123',
    groupId: 'group123',
    isAdmin: false,
    isActive: true,
    permissions: ['view_logs', 'send_messages'],
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z'),
  };

  return {
    ...defaults,
    ...overrides,
    toObject: jest.fn().mockImplementation(() => {
      const { password, ...userWithoutPassword } = { ...defaults, ...overrides };
      return userWithoutPassword;
    }),
    save: jest.fn().mockResolvedValue({ ...defaults, ...overrides }),
  } as any;
};

/**
 * Create a mock admin user
 */
export const createMockAdminUser = (overrides: MockUserData = {}): Partial<UserDocument> => {
  return createMockUser({
    userId: 'admin123',
    username: 'adminuser',
    isAdmin: true,
    permissions: [
      'create_user',
      'delete_user',
      'manage_users',
      'manage_groups',
      'send_messages',
      'view_logs',
      'system_admin',
    ],
    ...overrides,
  });
};

/**
 * Create a mock user without permissions
 */
export const createMockUserWithoutPermissions = (overrides: MockUserData = {}): Partial<UserDocument> => {
  return createMockUser({
    permissions: [],
    ...overrides,
  });
};

/**
 * Create a mock inactive user
 */
export const createMockInactiveUser = (overrides: MockUserData = {}): Partial<UserDocument> => {
  return createMockUser({
    isActive: false,
    ...overrides,
  });
};
