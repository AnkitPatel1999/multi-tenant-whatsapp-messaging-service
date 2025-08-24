import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
  /** Cache key template (can use method parameters) */
  key: string;
  /** TTL in seconds */
  ttl?: number;
  /** Condition to check before caching */
  condition?: string;
  /** Sync/async cache behavior */
  sync?: boolean;
}

/**
 * Decorator to mark methods as cacheable
 * @param options Caching configuration
 */
export const Cacheable = (options: CacheableOptions) =>
  SetMetadata(CACHEABLE_KEY, options);

/**
 * Common cache key patterns
 */
export const CacheKeys = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  TENANT_DATA: (tenantId: string) => `tenant:${tenantId}`,
  DEVICE_STATUS: (deviceId: string) => `device:status:${deviceId}`,
  WHATSAPP_CONTACTS: (deviceId: string) => `whatsapp:contacts:${deviceId}`,
  WHATSAPP_GROUPS: (deviceId: string) => `whatsapp:groups:${deviceId}`,
  USER_PERMISSIONS: (userId: string, tenantId: string) => `permissions:${userId}:${tenantId}`,
  CHAT_HISTORY: (deviceId: string, chatId: string, page: number) => 
    `chat:history:${deviceId}:${chatId}:${page}`,
  MESSAGE_STATS: (deviceId: string, userId: string) => `stats:messages:${deviceId}:${userId}`,
} as const;
