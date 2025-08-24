import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const result = await this.cacheManager.get<T>(key);
    return result || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<T> {
    await this.cacheManager.set(key, value, ttl);
    return value;
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    return await this.cacheManager.wrap(key, fn, ttl);
  }

  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};
    
    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }
    
    return result;
  }

  async setMultiple<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const promises = entries.map(({ key, value, ttl }) => this.set(key, value, ttl));
    await Promise.all(promises);
  }

  async delMultiple(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.del(key));
    await Promise.all(promises);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async ttl(key: string): Promise<number> {
    // Note: cache-manager doesn't have a direct ttl method
    // This is a placeholder implementation
    return -1;
  }

  async touch(key: string, ttl?: number): Promise<void> {
    const value = await this.get(key);
    if (value !== null) {
      await this.set(key, value, ttl);
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + value;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = Math.max(0, current - value);
    await this.set(key, newValue);
    return newValue;
  }

  async getList<T>(key: string): Promise<T[]> {
    const result = await this.get<T[]>(key);
    return result || [];
  }

  async addToList<T>(key: string, value: T, ttl?: number): Promise<void> {
    const list = await this.getList<T>(key);
    list.push(value);
    await this.set(key, list, ttl);
  }

  async removeFromList<T>(key: string, value: T, ttl?: number): Promise<void> {
    const list = await this.getList<T>(key);
    const filteredList = list.filter(item => item !== value);
    await this.set(key, filteredList, ttl);
  }

  async getSet<T>(key: string): Promise<T[]> {
    const result = await this.get<T[]>(key);
    return result || [];
  }

  async addToSet<T>(key: string, value: T, ttl?: number): Promise<void> {
    const set = await this.getSet<T>(key);
    if (!set.includes(value)) {
      set.push(value);
      await this.set(key, set, ttl);
    }
  }

  async removeFromSet<T>(key: string, value: T, ttl?: number): Promise<void> {
    const set = await this.getSet<T>(key);
    const filteredSet = set.filter(item => item !== value);
    await this.set(key, filteredSet, ttl);
  }

  async getHash<T>(key: string): Promise<Record<string, T>> {
    const result = await this.get<Record<string, T>>(key);
    return result || {};
  }

  async setHashField<T>(key: string, field: string, value: T, ttl?: number): Promise<void> {
    const hash = await this.getHash<T>(key);
    hash[field] = value;
    await this.set(key, hash, ttl);
  }

  async getHashField<T>(key: string, field: string): Promise<T | null> {
    const hash = await this.getHash<T>(key);
    return hash[field] || null;
  }

  async removeHashField(key: string, field: string, ttl?: number): Promise<void> {
    const hash = await this.getHash(key);
    delete hash[field];
    await this.set(key, hash, ttl);
  }

  async clear(): Promise<void> {
    try {
      // Note: cache-manager doesn't have a reset method
      // This is a placeholder - in production you might want to implement pattern-based clearing
      console.warn('Cache clear not implemented - requires pattern-based clearing');
    } catch (error) {
      console.warn('Cache clear failed');
    }
  }

  async getStats(): Promise<{
    keys: number;
    memory: number;
    hits: number;
    misses: number;
  }> {
    // Note: cache-manager doesn't provide detailed stats
    // This is a placeholder implementation
    return {
      keys: 0,
      memory: 0,
      hits: 0,
      misses: 0
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to set and get a test value
      const testKey = '__health_check__';
      const testValue = Date.now();
      
      await this.set(testKey, testValue, 10);
      const retrieved = await this.get<number>(testKey);
      
      if (retrieved === testValue) {
        await this.del(testKey);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}


