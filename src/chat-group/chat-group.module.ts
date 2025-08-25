import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGroupService } from './chat-group.service';
import { ChatGroupController } from './chat-group.controller';
import { WhatsAppGroup, WhatsAppGroupSchema } from '../schema/whatsapp-group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppGroup.name, schema: WhatsAppGroupSchema },
    ]),
  ],
  providers: [ChatGroupService],
  controllers: [ChatGroupController],
  exports: [ChatGroupService],
})
export class ChatGroupModule {}