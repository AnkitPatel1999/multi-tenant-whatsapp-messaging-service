
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

// Schemas
import { TenantSchema } from './schema/tenant.schema';
import { UserSchema } from './schema/user.schema';
import { UserGroupSchema } from './schema/user-group.schema';
import { WhatsAppDeviceSchema } from './schema/whatsapp-device.schema';
import { MessageLogSchema } from './schema/message-log.schema';
import { ContactSchema } from './schema/contact.schema';
import { ChatGroupSchema } from './schema/chat-group.schema';
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

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // process.env.MONGODB_URI || configService.get('database.url') ||
        uri:  'mongodb://localhost:27018/whatsapp-system',
        onConnectionCreate: (connection: Connection) => {
          connection.on('connected', () => console.log('MongoDB connected'));
          connection.on('open', () => console.log('MongoDB open'));
          connection.on('disconnected', () => console.log('MongoDB disconnected'));
          connection.on('reconnected', () => console.log('MongoDB reconnected'));
          connection.on('disconnecting', () => console.log('MongoDB disconnecting'));
          return connection;
        }
      }),
      inject: [ConfigService],
    }),

    MongooseModule.forFeature([
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'UserGroup', schema: UserGroupSchema },
      { name: 'WhatsAppDevice', schema: WhatsAppDeviceSchema },
              { name: 'WhatsAppSession', schema: WhatsAppSessionSchema },
        { name: 'WhatsAppContact', schema: WhatsAppContactSchema },
        { name: 'WhatsAppGroup', schema: WhatsAppGroupSchema },
        { name: 'WhatsAppMessage', schema: WhatsAppMessageSchema },
      { name: 'MessageLog', schema: MessageLogSchema },
      { name: 'Contact', schema: ContactSchema },
      { name: 'ChatGroup', schema: ChatGroupSchema },
    ]),

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