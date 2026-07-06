import { Module } from '@nestjs/common';

import { SocialChannelsController } from './social-channels.controller.js';
import { SocialChannelsService } from './social-channels.service.js';

@Module({
  controllers: [SocialChannelsController],
  providers: [SocialChannelsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SocialChannelsModule {}
