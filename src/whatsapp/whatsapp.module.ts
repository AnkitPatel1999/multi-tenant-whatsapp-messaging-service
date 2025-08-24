import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppDevice, WhatsAppDeviceSchema } from '../schema/whatsapp-device.schema';
import { WhatsAppSession, WhatsAppSessionSchema } from '../schema/whatsapp-session.schema';
import { WhatsAppContact, WhatsAppContactSchema } from '../schema/whatsapp-contact.schema';
import { WhatsAppGroup, WhatsAppGroupSchema } from '../schema/whatsapp-group.schema';
import { MessageLog, MessageLogSchema } from '../schema/message-log.schema';
import { BaileysService } from './baileys.service';
import { DatabaseAuthStateService } from './auth-state/database-auth-state.service';
import { WhatsAppSyncService } from './sync/whatsapp-sync.service';
import { EncryptionModule } from '../common/encryption/encryption.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppDevice.name, schema: WhatsAppDeviceSchema },
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
      { name: WhatsAppContact.name, schema: WhatsAppContactSchema },
      { name: WhatsAppGroup.name, schema: WhatsAppGroupSchema },
      { name: MessageLog.name, schema: MessageLogSchema },
    ]),
    EncryptionModule,
  ],
  providers: [
    WhatsAppService, 
    BaileysService, 
    DatabaseAuthStateService,
    WhatsAppSyncService
  ],
  controllers: [WhatsAppController],
  exports: [
    WhatsAppService, 
    BaileysService, 
    DatabaseAuthStateService,
    WhatsAppSyncService
  ],
})
export class WhatsAppModule {}