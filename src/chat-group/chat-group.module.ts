import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGroupService } from './chat-group.service';
import { ChatGroupController } from './chat-group.controller';
import { ChatGroup, ChatGroupSchema } from '../schema/chat-group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatGroup.name, schema: ChatGroupSchema },
    ]),
  ],
  providers: [ChatGroupService],
  controllers: [ChatGroupController],
  exports: [ChatGroupService],
})
export class ChatGroupModule {}