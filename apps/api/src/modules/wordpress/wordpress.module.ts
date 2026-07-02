import { Module } from '@nestjs/common';

import { SocialContentGeneratorService } from './application/social-content-generator.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WordPressService } from './application/wordpress.service.js';
import { WordPressRepository } from './infrastructure/wordpress.repository.js';
import { WordPressRestClient } from './infrastructure/wordpress-rest.client.js';
import { WordPressSecretService } from './infrastructure/wordpress-secret.service.js';
import { WordPressController } from './wordpress.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [WordPressController],
  providers: [
    WordPressService,
    SocialContentGeneratorService,
    WordPressRepository,
    WordPressRestClient,
    WordPressSecretService,
  ],
  exports: [WordPressService],
})
// NestJS module classes are declarative containers.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WordPressModule {}
