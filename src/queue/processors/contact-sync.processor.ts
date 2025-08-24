import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { ContactSyncJobData } from '../services/message-queue.service';
import { WhatsAppSyncService } from '../../whatsapp/sync/whatsapp-sync.service';
import { BaileysService } from '../../whatsapp/baileys.service';
import { CacheService } from '../../cache/cache.service';

@Processor('contact-sync')
@Injectable()
export class ContactSyncProcessor {
  private readonly logger = new Logger(ContactSyncProcessor.name);

  constructor(
    private whatsappSyncService: WhatsAppSyncService,
    private baileysService: BaileysService,
    private cacheService: CacheService,
  ) {}

  @Process('sync-contacts')
  async syncContacts(job: Job<ContactSyncJobData>): Promise<any> {
    const { data } = job;
    const startTime = Date.now();

    this.logger.log(`Processing contact sync job ${job.id}`, {
      deviceId: data.deviceId,
      syncType: data.syncType,
      lastSyncAt: data.lastSyncAt,
    });

    try {
      await job.progress(10);

      // Get device connection
      const connection = this.baileysService.getConnection(data.deviceId);
      if (!connection) {
        throw new Error(`Device ${data.deviceId} is not connected`);
      }

      await job.progress(25);

      // Check if we should skip sync (too recent)
      if (await this.shouldSkipSync(data)) {
        this.logger.log(`Skipping contact sync - too recent for device ${data.deviceId}`);
        return { skipped: true, reason: 'Recent sync already performed' };
      }

      await job.progress(50);

      // Perform the sync
      const result = await this.whatsappSyncService.syncContacts(data.deviceId, connection);

      await job.progress(75);

      // Cache the results
      await this.cacheService.set(
        `whatsapp_contacts:${data.deviceId}`, 
        await this.getContactsForCache(data.deviceId, data.userId, data.tenantId),
        1800 // 30 minutes TTL
      );

      // Update sync timestamp
      await this.updateLastSyncTimestamp(data.deviceId);

      await job.progress(100);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Contact sync completed`, {
        jobId: job.id,
        deviceId: data.deviceId,
        synced: result.synced,
        errors: result.errors,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Contact sync failed`, {
        jobId: job.id,
        deviceId: data.deviceId,
        error: error.message,
        processingTime: `${processingTime}ms`,
        attempt: job.attemptsMade,
      });

      // Cache failed sync info
      await this.cacheFailedSync(data, error);

      throw error; // Let Bull handle retries
    }
  }

  @Process('sync-groups')
  async syncGroups(job: Job<ContactSyncJobData>): Promise<any> {
    const { data } = job;
    const startTime = Date.now();

    this.logger.log(`Processing group sync job ${job.id}`, {
      deviceId: data.deviceId,
      syncType: data.syncType,
    });

    try {
      await job.progress(10);

      const connection = this.baileysService.getConnection(data.deviceId);
      if (!connection) {
        throw new Error(`Device ${data.deviceId} is not connected`);
      }

      await job.progress(50);

      const result = await this.whatsappSyncService.syncGroups(data.deviceId, connection);

      await job.progress(75);

      // Cache the results
      await this.cacheService.set(
        `whatsapp_groups:${data.deviceId}`,
        await this.getGroupsForCache(data.deviceId, data.userId, data.tenantId),
        1800 // 30 minutes TTL
      );

      await job.progress(100);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Group sync completed`, {
        jobId: job.id,
        deviceId: data.deviceId,
        synced: result.synced,
        errors: result.errors,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: true,
        synced: result.synced,
        errors: result.errors,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`Group sync failed`, {
        jobId: job.id,
        deviceId: data.deviceId,
        error: error.message,
        attempt: job.attemptsMade,
      });

      throw error;
    }
  }

  /**
   * Check if sync should be skipped due to recent sync
   */
  private async shouldSkipSync(data: ContactSyncJobData): Promise<boolean> {
    if (data.syncType === 'full') {
      return false; // Always allow full sync
    }

    const lastSyncKey = `last_contact_sync:${data.deviceId}`;
    const lastSync = await this.cacheService.get<string>(lastSyncKey);
    
    if (!lastSync) {
      return false; // No previous sync
    }

    const lastSyncTime = new Date(lastSync);
    const minInterval = 5 * 60 * 1000; // 5 minutes minimum between syncs

    return (Date.now() - lastSyncTime.getTime()) < minInterval;
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTimestamp(deviceId: string): Promise<void> {
    const lastSyncKey = `last_contact_sync:${deviceId}`;
    await this.cacheService.set(lastSyncKey, new Date().toISOString(), 86400);
  }

  /**
   * Get contacts for caching
   */
  private async getContactsForCache(deviceId: string, userId: string, tenantId: string): Promise<any[]> {
    try {
      return await this.whatsappSyncService.getContacts(deviceId, userId, tenantId);
    } catch (error) {
      this.logger.warn(`Failed to get contacts for cache:`, error.message);
      return [];
    }
  }

  /**
   * Get groups for caching
   */
  private async getGroupsForCache(deviceId: string, userId: string, tenantId: string): Promise<any[]> {
    try {
      return await this.whatsappSyncService.getGroups(deviceId, userId, tenantId);
    } catch (error) {
      this.logger.warn(`Failed to get groups for cache:`, error.message);
      return [];
    }
  }

  /**
   * Cache failed sync information
   */
  private async cacheFailedSync(data: ContactSyncJobData, error: Error): Promise<void> {
    try {
      const failureKey = `sync_failure:${data.deviceId}`;
      const failureInfo = {
        deviceId: data.deviceId,
        syncType: data.syncType,
        error: error.message,
        failedAt: new Date().toISOString(),
        attempt: 1, // Job attempt information would be passed here
      };

      await this.cacheService.set(failureKey, failureInfo, 3600); // 1 hour
    } catch (cacheError) {
      this.logger.warn('Failed to cache sync failure:', cacheError.message);
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job, result: any): Promise<void> {
    this.logger.debug(`Sync job ${job.id} completed with result:`, result);
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Sync job ${job.id} failed permanently:`, error.message);
  }
}
