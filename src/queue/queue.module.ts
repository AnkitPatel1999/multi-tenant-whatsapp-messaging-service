import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessageQueueService } from './services/message-queue.service';
import { MessageProcessor } from './processors/message.processor';
// import { ContactSyncProcessor } from './processors/contact-sync.processor';
// import { QueueManagerService } from './services/queue-manager.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MessageModule } from '../message/message.module';
import { AppCacheModule } from '../cache/cache.module';

export const QUEUE_NAMES = {
  WHATSAPP_MESSAGE: 'whatsapp-message',
  CONTACT_SYNC: 'contact-sync',
  GROUP_SYNC: 'group-sync',
  FILE_UPLOAD: 'file-upload',
  NOTIFICATION: 'notification',
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_QUEUE_DB', 1),
        },
        // Global queue settings
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50,      // Keep last 50 failed jobs
        },
        // Performance settings
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 1,
        },
      }),
      inject: [ConfigService],
    }),
    // Register individual queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.WHATSAPP_MESSAGE },
      { name: QUEUE_NAMES.CONTACT_SYNC },
      { name: QUEUE_NAMES.GROUP_SYNC },
      { name: QUEUE_NAMES.FILE_UPLOAD },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
    // Import modules that provide dependencies for processors
    WhatsAppModule,
    MessageModule,
    AppCacheModule,
  ],
  providers: [
    MessageQueueService,
    MessageProcessor,
    // QueueManagerService,
  ],
  exports: [
    MessageQueueService,
    // QueueManagerService,
    BullModule,
  ],
})
export class QueueModule {}
