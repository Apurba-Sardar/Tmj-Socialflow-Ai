import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { MediaController } from './media.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MediaModule {}
