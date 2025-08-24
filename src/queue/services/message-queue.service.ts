import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, JobOptions } from 'bull';

export interface MessageJobData {
  deviceId: string;
  userId: string;
  tenantId: string;
  to: string;
  message: string;
  type: 'text' | 'media' | 'document' | 'location' | 'contact';
  priority: 'low' | 'normal' | 'high' | 'critical';
  scheduledAt?: Date;
  metadata?: Record<string, any>;
  retryCount?: number;
  correlationId?: string; // For tracking message flows
}

export interface ContactSyncJobData {
  deviceId: string;
  userId: string;
  tenantId: string;
  syncType: 'full' | 'incremental';
  lastSyncAt?: Date;
}

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  constructor(
    @InjectQueue('whatsapp-message') 
    private messageQueue: Queue<MessageJobData>,
    @InjectQueue('contact-sync') 
    private contactSyncQueue: Queue<ContactSyncJobData>,
    @InjectQueue('notification') 
    private notificationQueue: Queue,
  ) {}

  /**
   * Queue WhatsApp message for async processing
   */
  async queueMessage(data: MessageJobData): Promise<string> {
    try {
      const jobOptions: JobOptions = {
        priority: this.getPriorityValue(data.priority),
        delay: data.scheduledAt ? new Date(data.scheduledAt).getTime() - Date.now() : 0,
        attempts: data.retryCount || 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      };

      // Add correlation ID for tracking
      if (!data.correlationId) {
        data.correlationId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const job = await this.messageQueue.add('send-message', data, jobOptions);
      
      this.logger.log(`Message queued for async processing`, {
        jobId: job.id,
        deviceId: data.deviceId,
        priority: data.priority,
        correlationId: data.correlationId,
        scheduledAt: data.scheduledAt,
      });

      return job.id.toString();
    } catch (error) {
      this.logger.error(`Failed to queue message:`, error.message);
      throw new Error(`Failed to queue message: ${error.message}`);
    }
  }

  /**
   * Queue bulk messages for high throughput scenarios
   */
  async queueBulkMessages(messages: MessageJobData[]): Promise<string[]> {
    try {
      const jobData = messages.map(msg => {
        if (!msg.correlationId) {
          msg.correlationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return {
          name: 'send-message',
          data: msg,
          opts: {
            priority: this.getPriorityValue(msg.priority),
            attempts: msg.retryCount || 3,
            backoff: { type: 'exponential', delay: 2000 },
          } as JobOptions,
        };
      });

      const jobs = await this.messageQueue.addBulk(jobData);
      const jobIds = jobs.map(job => job.id.toString());

      this.logger.log(`Bulk messages queued`, {
        count: messages.length,
        jobIds: jobIds.slice(0, 5), // Log first 5 IDs
      });

      return jobIds;
    } catch (error) {
      this.logger.error(`Failed to queue bulk messages:`, error.message);
      throw new Error(`Failed to queue bulk messages: ${error.message}`);
    }
  }

  /**
   * Queue contact sync operation
   */
  async queueContactSync(data: ContactSyncJobData): Promise<string> {
    try {
      const job = await this.contactSyncQueue.add('sync-contacts', data, {
        priority: 5, // Medium priority
        attempts: 2,
        backoff: { type: 'fixed', delay: 30000 }, // 30 second delay between retries
        removeOnComplete: 10,
      });

      this.logger.log(`Contact sync queued`, {
        jobId: job.id,
        deviceId: data.deviceId,
        syncType: data.syncType,
      });

      return job.id.toString();
    } catch (error) {
      this.logger.error(`Failed to queue contact sync:`, error.message);
      throw error;
    }
  }

  /**
   * Get message queue statistics
   */
  async getMessageQueueStats(): Promise<any> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.messageQueue.getWaiting(),
        this.messageQueue.getActive(),
        this.messageQueue.getCompleted(),
        this.messageQueue.getFailed(),
        this.messageQueue.getDelayed(),
      ]);

      return {
        queue: 'whatsapp-message', // Assuming QUEUE_NAMES.WHATSAPP_MESSAGE is removed
        counts: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
        },
        throughput: {
          processed: completed.length,
          failed: failed.length,
          successRate: completed.length > 0 ? 
            ((completed.length / (completed.length + failed.length)) * 100).toFixed(2) + '%' : '0%',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get queue stats:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Pause message processing (for maintenance)
   */
  async pauseMessageQueue(): Promise<void> {
    await this.messageQueue.pause();
    this.logger.warn('Message queue paused');
  }

  /**
   * Resume message processing
   */
  async resumeMessageQueue(): Promise<void> {
    await this.messageQueue.resume();
    this.logger.log('Message queue resumed');
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.messageQueue.getJob(jobId);
      if (!job) {
        return { status: 'not_found' };
      }

      return {
        id: job.id,
        status: await job.getState(),
        progress: job.progress(),
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        data: job.data,
        failedReason: job.failedReason,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status for ${jobId}:`, error.message);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Cancel a queued job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.messageQueue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();
      this.logger.log(`Job ${jobId} cancelled`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel job ${jobId}:`, error.message);
      return false;
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.messageQueue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.retry();
      this.logger.log(`Job ${jobId} retried`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to retry job ${jobId}:`, error.message);
      return false;
    }
  }

  /**
   * Convert priority string to numeric value
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 3;
      case 'normal': return 5;
      case 'low': return 10;
      default: return 5;
    }
  }

  /**
   * Clean old completed jobs
   */
  async cleanOldJobs(): Promise<void> {
    try {
      // Remove completed jobs older than 24 hours
      await this.messageQueue.clean(24 * 60 * 60 * 1000, 'completed');
      
      // Remove failed jobs older than 7 days
      await this.messageQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      
      this.logger.log('Old jobs cleaned from queue');
    } catch (error) {
      this.logger.error('Failed to clean old jobs:', error.message);
    }
  }
}
