import { Controller, Get } from '@nestjs/common';

import { SupabaseService } from './supabase.service.js';

@Controller('supabase')
export class SupabaseController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get('health')
  health() {
    return this.supabaseService.health();
  }
}
