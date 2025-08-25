import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { WhatsAppMessage, WhatsAppMessageSchema } from '../schema/whatsapp-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppMessage.name, schema: WhatsAppMessageSchema },
    ]),
  ],
  providers: [MessageService],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
