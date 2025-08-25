import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { MessageService } from '../../message/message.service';
import { CacheService } from '../../cache/cache.service';

export interface MessageJobData {
  deviceId: string;
  userId: string;
  tenantId: string;
  to: string;
  message: string;
  type: 'text' | 'media' | 'document' | 'location' | 'contact';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
@Processor('whatsapp-message')
export class MessageProcessor {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private whatsappService: WhatsAppService,
    private messageService: MessageService,
    private cacheService: CacheService,
  ) {}

  @Process('send-message')
  async sendMessage(job: Job<MessageJobData>): Promise<any> {
    const { data } = job;
    const startTime = Date.now();

    this.logger.log(`Processing message job ${job.id}`, {
      deviceId: data.deviceId,
      to: data.to,
      type: data.type,
      priority: data.priority,
    });

    try {
      await job.progress(10);

      // Validate device connection
      const device = await this.whatsappService.findById(data.deviceId);
      if (!device) {
        throw new Error(`Device ${data.deviceId} not found`);
      }

      if (!device.isConnected) {
        throw new Error(`Device ${data.deviceId} is not connected`);
      }

      await job.progress(30);

      // Send the message
      const result = await this.whatsappService.sendMessage({
        deviceId: data.deviceId,
        userId: data.userId,
        tenantId: data.tenantId,
        to: data.to,
        message: data.message,
        type: data.type === 'document' || data.type === 'location' || data.type === 'contact' ? 'media' : data.type
      });

      await job.progress(70);

      // Log the message
      await this.messageService.logMessage({
        deviceId: data.deviceId,
        userId: data.userId,
        tenantId: data.tenantId,
        toJid: data.to,
        textContent: data.message,
        messageType: data.type === 'document' || data.type === 'location' || data.type === 'contact' ? 'media' : data.type,
        status: 'sent',
        messageId: result.messageId,
        chatId: data.to,
        fromJid: data.deviceId,
        direction: 'outgoing',
        timestamp: new Date(),
      });

      await job.progress(100);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Message sent successfully`, {
        jobId: job.id,
        deviceId: data.deviceId,
        to: data.to,
        messageId: result.messageId,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: true,
        messageId: result.messageId,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Message sending failed`, {
        jobId: job.id,
        deviceId: data.deviceId,
        to: data.to,
        error: error.message,
        processingTime: `${processingTime}ms`,
        attempt: job.attemptsMade,
      });

      // Log failed message
      await this.messageService.logMessage({
        deviceId: data.deviceId,
        userId: data.userId,
        tenantId: data.tenantId,
        toJid: data.to,
        textContent: data.message,
        messageType: data.type === 'document' || data.type === 'location' || data.type === 'contact' ? 'media' : data.type,
        status: 'failed',
        messageId: `FAILED_${Date.now()}`,
        chatId: data.to,
        fromJid: data.deviceId,
        direction: 'outgoing',
        timestamp: new Date(),
      });

      throw error; // Let Bull handle retries
    }
  }

  @Process('bulk-send')
  async bulkSend(job: Job<{ messages: MessageJobData[] }>): Promise<any> {
    const { data } = job;
    const startTime = Date.now();
    const results: Array<{ success: boolean; messageId?: string; processingTime?: number; completedAt?: string; error?: string; to?: string }> = [];

    this.logger.log(`Processing bulk send job ${job.id}`, {
      messageCount: data.messages.length,
    });

    try {
      for (let i = 0; i < data.messages.length; i++) {
        const messageData = data.messages[i];
        
        try {
          const result = await this.sendMessage({
            ...job,
            data: messageData,
          } as unknown as Job<MessageJobData>);
          
          results.push({ success: true, ...result });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error.message,
            to: messageData.to 
          });
        }

        await job.progress((i + 1) / data.messages.length * 100);
      }

      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk send completed`, {
        jobId: job.id,
        total: data.messages.length,
        success: successCount,
        failure: failureCount,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: true,
        results,
        total: data.messages.length,
        successCount,
        failureCount,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Bulk send failed`, {
        jobId: job.id,
        error: error.message,
        processingTime: `${processingTime}ms`,
        attempt: job.attemptsMade,
      });

      throw error;
    }
  }

  @Process('retry-failed')
  async retryFailed(job: Job<{ messageId: string; tenantId: string; userId: string }>): Promise<any> {
    const { data } = job;
    const startTime = Date.now();

    this.logger.log(`Processing retry job ${job.id}`, {
      messageId: data.messageId,
    });

    try {
      // Get the failed message from database
      const failedMessages = await this.messageService.getMessages(
        data.tenantId,
        data.userId,
        undefined,
        1
      );
      
      const failedMessage = failedMessages.find(msg => msg.messageId === data.messageId);
      if (!failedMessage) {
        throw new Error(`Failed message ${data.messageId} not found`);
      }

      await job.progress(30);

      // Retry sending
      const result = await this.sendMessage({
        ...job,
        data: {
          deviceId: failedMessage.deviceId,
          userId: failedMessage.userId,
          tenantId: failedMessage.tenantId,
          to: failedMessage.toJid || failedMessage.chatId,
          message: failedMessage.textContent,
          type: failedMessage.messageType,
        } as MessageJobData,
      } as unknown as Job<MessageJobData>);

      await job.progress(70);

      // Update message status by logging a new entry
      await this.messageService.logMessage({
        deviceId: failedMessage.deviceId,
        userId: failedMessage.userId,
        tenantId: failedMessage.tenantId,
        messageId: failedMessage.messageId,
        chatId: failedMessage.chatId,
        fromJid: failedMessage.fromJid,
        toJid: failedMessage.toJid,
        textContent: failedMessage.textContent,
        messageType: failedMessage.messageType,
        direction: failedMessage.direction,
        status: 'sent',
        timestamp: new Date(),
      });

      await job.progress(100);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Message retry successful`, {
        jobId: job.id,
        messageId: data.messageId,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: true,
        messageId: data.messageId,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Message retry failed`, {
        jobId: job.id,
        messageId: data.messageId,
        error: error.message,
        processingTime: `${processingTime}ms`,
        attempt: job.attemptsMade,
      });

      throw error;
    }
  }

  @Process('cleanup-old-messages')
  async cleanupOldMessages(job: Job): Promise<any> {
    const startTime = Date.now();

    this.logger.log(`Processing cleanup job ${job.id}`);

    try {
      await job.progress(10);

      // Clean up messages older than 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      // Note: MessageService doesn't have deleteOldMessages method
      // This would need to be implemented or handled differently
      const deletedCount = 0; // Placeholder

      await job.progress(100);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Cleanup completed`, {
        jobId: job.id,
        deletedCount,
        processingTime: `${processingTime}ms`,
      });

      return {
        success: true,
        deletedCount,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error(`Cleanup failed`, {
        jobId: job.id,
        error: error.message,
        processingTime: `${processingTime}ms`,
        attempt: job.attemptsMade,
      });

      throw error;
    }
  }

  @Process('completed')
  async handleCompleted(job: Job): Promise<void> {
    this.logger.log(`Job ${job.id} completed successfully`, {
      jobId: job.id,
      queue: job.queue.name,
      data: job.data,
    });

    // Clean up any temporary data
    await this.cacheService.del(`job:${job.id}`);
  }

  @Process('failed')
  async handleFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`Job ${job.id} failed`, {
      jobId: job.id,
      queue: job.queue.name,
      data: job.data,
      error: error.message,
      attempts: job.attemptsMade,
    });

    // Store failed job info for debugging
    await this.cacheService.set(`failed_job:${job.id}`, {
      jobId: job.id,
      queue: job.queue.name,
      data: job.data,
      error: error.message,
      failedAt: new Date().toISOString(),
      attempts: job.attemptsMade,
    }, 86400); // 24 hours
  }
}
