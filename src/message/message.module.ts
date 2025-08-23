import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageLog, MessageLogSchema } from '../schema/message-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MessageLog.name, schema: MessageLogSchema },
    ]),
  ],
  providers: [MessageService],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
