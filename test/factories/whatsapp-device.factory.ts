import { WhatsAppDeviceDocument } from '../../src/schema/whatsapp-device.schema';
import { SendMessageData, WhatsAppMessageResult } from '../../src/dto/whatsapp.dto';

export interface MockWhatsAppDeviceData {
  deviceId?: string;
  userId?: string;
  tenantId?: string;
  deviceName?: string;
  groupId?: string;
  isActive?: boolean;
  isConnected?: boolean;
  lastConnectedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create a mock WhatsApp device for testing
 */
export const createMockWhatsAppDevice = (overrides: MockWhatsAppDeviceData = {}): Partial<WhatsAppDeviceDocument> => {
  const defaults = {
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    deviceName: 'Test Device',
    groupId: 'group123',
    isActive: true,
    isConnected: true,
    lastConnectedAt: new Date('2023-01-01T12:00:00Z'),
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T12:00:00Z'),
  };

  return {
    ...defaults,
    ...overrides,
    save: jest.fn().mockResolvedValue({ ...defaults, ...overrides }),
    toObject: jest.fn().mockReturnValue({ ...defaults, ...overrides }),
  } as any;
};

/**
 * Create a mock disconnected WhatsApp device
 */
export const createMockDisconnectedDevice = (overrides: MockWhatsAppDeviceData = {}): Partial<WhatsAppDeviceDocument> => {
  return createMockWhatsAppDevice({
    isConnected: false,
    lastConnectedAt: new Date('2023-01-01T10:00:00Z'),
    ...overrides,
  });
};

/**
 * Create mock send message data
 */
export const createMockSendMessageData = (overrides: Partial<SendMessageData> = {}): SendMessageData => {
  const defaults = {
    deviceId: 'device123',
    userId: 'user123',
    tenantId: 'tenant123',
    to: '+1234567890',
    message: 'Test message',
    type: 'text' as const,
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Create mock media message data
 */
export const createMockMediaMessageData = (overrides: Partial<SendMessageData> = {}): SendMessageData => {
  return createMockSendMessageData({
    type: 'media',
    message: 'https://example.com/image.jpg',
    ...overrides,
  });
};

/**
 * Create mock WhatsApp message result
 */
export const createMockMessageResult = (overrides: Partial<WhatsAppMessageResult> = {}): WhatsAppMessageResult => {
  const defaults = {
    success: true,
    messageId: 'msg123456',
    timestamp: new Date('2023-01-01T12:00:00Z'),
  };

  return {
    ...defaults,
    ...overrides,
  };
};

/**
 * Create mock connection status
 */
export const createMockConnectionStatus = (overrides: any = {}) => {
  const defaults = {
    deviceId: 'device123',
    isConnected: true,
    deviceInfo: null,
    hasQR: false,
  };

  return {
    ...defaults,
    ...overrides,
  };
};
