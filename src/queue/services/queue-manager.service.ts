import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class QueueManagerService {
  private readonly logger = new Logger(QueueManagerService.name);

  constructor(
    @InjectQueue('whatsapp-message') private messageQueue: Queue,
    @InjectQueue('contact-sync') private contactSyncQueue: Queue,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  /**
   * Get comprehensive statistics for all queues
   */
  async getAllQueueStats(): Promise<any> {
    try {
      const [messageStats, contactStats, notificationStats] = await Promise.all([
        this.getQueueStats(this.messageQueue, 'whatsapp-message'),
        this.getQueueStats(this.contactSyncQueue, 'contact-sync'),
        this.getQueueStats(this.notificationQueue, 'notification'),
      ]);

      return {
        queues: {
          'whatsapp-message': messageStats,
          'contact-sync': contactStats,
          'notification': notificationStats,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get queue statistics:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Get statistics for a specific queue
   */
  private async getQueueStats(queue: Queue, queueName: string): Promise<any> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        name: queueName,
        counts: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
        },
        health: {
          status: active.length > 0 ? 'processing' : 'idle',
          backlog: waiting.length + delayed.length,
          successRate: completed.length > 0 ? 
            ((completed.length / (completed.length + failed.length)) * 100).toFixed(2) + '%' : '100%',
        },
      };
    } catch (error) {
      return {
        name: queueName,
        error: error.message,
      };
    }
  }

  /**
   * Pause all queues
   */
  async pauseAllQueues(): Promise<void> {
    try {
      await Promise.all([
        this.messageQueue.pause(),
        this.contactSyncQueue.pause(),
        this.notificationQueue.pause(),
      ]);

      this.logger.warn('All queues paused');
    } catch (error) {
      this.logger.error('Failed to pause queues:', error.message);
      throw error;
    }
  }

  /**
   * Resume all queues
   */
  async resumeAllQueues(): Promise<void> {
    try {
      await Promise.all([
        this.messageQueue.resume(),
        this.contactSyncQueue.resume(),
        this.notificationQueue.resume(),
      ]);

      this.logger.log('All queues resumed');
    } catch (error) {
      this.logger.error('Failed to resume queues:', error.message);
      throw error;
    }
  }

  /**
   * Clean old jobs from all queues
   */
  async cleanAllQueues(): Promise<any> {
    try {
      const results = await Promise.allSettled([
        this.cleanQueue(this.messageQueue, 'whatsapp-message'),
        this.cleanQueue(this.contactSyncQueue, 'contact-sync'),
        this.cleanQueue(this.notificationQueue, 'notification'),
      ]);

      return {
        cleaned: results.map((result, index) => ({
          queue: ['whatsapp-message', 'contact-sync', 'notification'][index],
          status: result.status,
          result: result.status === 'fulfilled' ? result.value : result.reason?.message,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to clean queues:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Clean old jobs from a specific queue
   */
  private async cleanQueue(queue: Queue, queueName: string): Promise<any> {
    try {
      // Remove completed jobs older than 24 hours
      const completedCleaned = await queue.clean(24 * 60 * 60 * 1000, 'completed');
      
      // Remove failed jobs older than 7 days
      const failedCleaned = await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

      this.logger.log(`Cleaned queue ${queueName}`, {
        completedJobsCleaned: completedCleaned.length,
        failedJobsCleaned: failedCleaned.length,
      });

      return {
        queue: queueName,
        completedJobsCleaned: completedCleaned.length,
        failedJobsCleaned: failedCleaned.length,
      };
    } catch (error) {
      this.logger.error(`Failed to clean queue ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get health status of all queues
   */
  async getQueueHealthStatus(): Promise<any> {
    try {
      const stats = await this.getAllQueueStats();
      
      const healthStatus = Object.entries(stats.queues).map(([queueName, queueStats]: [string, any]) => ({
        queue: queueName,
        status: queueStats.health?.status || 'unknown',
        backlog: queueStats.counts?.waiting || 0,
        errors: queueStats.counts?.failed || 0,
        isHealthy: (queueStats.counts?.waiting || 0) < 1000 && (queueStats.counts?.failed || 0) < 100,
      }));

      const overallHealth = healthStatus.every(q => q.isHealthy) ? 'healthy' : 'degraded';

      return {
        overall: overallHealth,
        queues: healthStatus,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get queue health status:', error.message);
      return {
        overall: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
