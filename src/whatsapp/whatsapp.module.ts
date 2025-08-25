import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppDevice, WhatsAppDeviceSchema } from '../schema/whatsapp-device.schema';
import { WhatsAppSession, WhatsAppSessionSchema } from '../schema/whatsapp-session.schema';
import { WhatsAppContact, WhatsAppContactSchema } from '../schema/whatsapp-contact.schema';
import { WhatsAppGroup, WhatsAppGroupSchema } from '../schema/whatsapp-group.schema';
import { WhatsAppMessage, WhatsAppMessageSchema } from '../schema/whatsapp-message.schema';
import { BaileysService } from './baileys.service';
import { DatabaseAuthStateService } from './auth-state/database-auth-state.service';
import { WhatsAppSyncService } from './sync/whatsapp-sync.service';
import { WhatsAppMessageService } from './message/whatsapp-message.service';
import { EncryptionModule } from '../common/encryption/encryption.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppDevice.name, schema: WhatsAppDeviceSchema },
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
      { name: WhatsAppContact.name, schema: WhatsAppContactSchema },
      { name: WhatsAppGroup.name, schema: WhatsAppGroupSchema },
      { name: WhatsAppMessage.name, schema: WhatsAppMessageSchema },
    ]),
    EncryptionModule,
  ],
  providers: [
    WhatsAppService, 
    BaileysService, 
    DatabaseAuthStateService,
    WhatsAppSyncService,
    WhatsAppMessageService
  ],
  controllers: [WhatsAppController],
  exports: [
    WhatsAppService, 
    BaileysService, 
    DatabaseAuthStateService,
    WhatsAppSyncService,
    WhatsAppMessageService
  ],
})
export class WhatsAppModule {}