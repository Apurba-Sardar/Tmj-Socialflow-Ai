import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('assets')
  async assets() {
    const assets = await this.prisma.mediaAsset.findMany({
      include: {
        folder: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      data: assets.map((asset) => ({
        id: asset.id,
        title: asset.name,
        type: asset.type.toLowerCase(),
        folder: asset.folder?.name ?? 'Unfiled',
        collection: 'Library',
        tags: Array.isArray(asset.metadata) ? [] : [],
        sizeBytes: asset.sizeBytes ?? 0,
        compressedBytes: asset.sizeBytes ?? 0,
        createdAt: asset.createdAt,
        previewUrl: asset.url,
      })),
    };
  }

  @Get('folders')
  async folders() {
    const folders = await this.prisma.mediaFolder.findMany({
      orderBy: { name: 'asc' },
    });

    return { data: folders };
  }
}
