import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnvironment } from '@socialflow/config';

@Injectable()
export class SupabaseService {
  private readonly env = loadEnvironment();
  private readonly adminClient: SupabaseClient | null;

  constructor() {
    const serverKey = this.env.SUPABASE_SERVICE_ROLE_KEY ?? this.env.SUPABASE_SECRET_KEY;
    this.adminClient =
      this.env.SUPABASE_URL && serverKey
        ? createClient(this.env.SUPABASE_URL, serverKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
        : null;
  }

  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      throw new ServiceUnavailableException('Supabase is not configured.');
    }

    return this.adminClient;
  }

  isConfigured(): boolean {
    return Boolean(this.adminClient);
  }

  async health() {
    if (!this.adminClient) {
      return {
        configured: false,
        connected: false,
        message: 'Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.',
      };
    }

    const { error } = await this.adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (error) {
      return {
        configured: true,
        connected: false,
        message: error.message,
      };
    }

    return {
      configured: true,
      connected: true,
      message: 'Supabase service role client is connected.',
    };
  }
}
