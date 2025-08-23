import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppDevice, WhatsAppDeviceSchema } from '../schema/whatsapp-device.schema';
import { MessageLog, MessageLogSchema } from '../schema/message-log.schema';
import { BaileysService } from './baileys.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppDevice.name, schema: WhatsAppDeviceSchema },
      { name: MessageLog.name, schema: MessageLogSchema },
    ]),
  ],
  providers: [WhatsAppService, BaileysService],
  controllers: [WhatsAppController],
  exports: [WhatsAppService, BaileysService],
})
export class WhatsAppModule {}