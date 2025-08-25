
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

// Scalability Infrastructure
import { AppCacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { DatabaseModule } from './database/database.module';

// Schemas
import { TenantSchema } from './schema/tenant.schema';
import { UserSchema } from './schema/user.schema';
import { UserGroupSchema } from './schema/user-group.schema';
import { WhatsAppDeviceSchema } from './schema/whatsapp-device.schema';
import { WhatsAppSessionSchema } from './schema/whatsapp-session.schema';
import { WhatsAppContactSchema } from './schema/whatsapp-contact.schema';
import { WhatsAppGroupSchema } from './schema/whatsapp-group.schema';
import { WhatsAppMessageSchema } from './schema/whatsapp-message.schema';

// Modules
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { MessageModule } from './message/message.module';
import { ContactModule } from './contact/contact.module';
import { ChatGroupModule } from './chat-group/chat-group.module';
import { AppThrottlerModule } from './common/throttler/throttler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Replace with optimized database configuration
    DatabaseModule,

    MongooseModule.forFeature([
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'UserGroup', schema: UserGroupSchema },
      { name: 'WhatsAppDevice', schema: WhatsAppDeviceSchema },
              { name: 'WhatsAppSession', schema: WhatsAppSessionSchema },
        { name: 'WhatsAppContact', schema: WhatsAppContactSchema },
        { name: 'WhatsAppGroup', schema: WhatsAppGroupSchema },
        { name: 'WhatsAppMessage', schema: WhatsAppMessageSchema },
    ]),

    // Scalability Infrastructure
    AppCacheModule,
    QueueModule,
    
    // Application Modules
    AppThrottlerModule,
    AuthModule,
    UserModule,
    WhatsAppModule,
    MessageModule,
    ContactModule,
    ChatGroupModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}