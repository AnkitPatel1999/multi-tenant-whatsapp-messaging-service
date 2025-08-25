import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';
import { WhatsAppContact, WhatsAppContactSchema } from '../schema/whatsapp-contact.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppContact.name, schema: WhatsAppContactSchema },
    ]),
  ],
  providers: [ContactService],
  controllers: [ContactController],
  exports: [ContactService],
})
export class ContactModule {}
