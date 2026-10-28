import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class DocumentStorageService {
  private readonly client: ReturnType<typeof createClient>;
  private readonly bucket: string;
  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.get<string>('SUPABASE_SECRET_KEY') ??
        config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (
            input: Parameters<typeof fetch>[0],
            init?: Parameters<typeof fetch>[1],
          ) =>
            fetch(input, {
              ...init,
              signal: AbortSignal.any([
                AbortSignal.timeout(60_000),
                ...(init?.signal ? [init.signal] : []),
              ]),
            }),
        },
      },
    );
    this.bucket =
      config.get<string>('SUPABASE_DOCUMENTS_BUCKET') ?? 'bond-documents';
  }
  private async privateBucket() {
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (error || !data || data.public)
      throw new ServiceUnavailableException(
        'El almacenamiento de documentos debe estar disponible y ser privado.',
      );
  }
  async upload(path: string, buffer: Buffer, mimeType: string) {
    await this.privateBucket();
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '0',
      });
    if (error)
      throw new ServiceUnavailableException(
        'No se pudo cargar el archivo. Reintentá.',
      );
  }
  async download(path: string): Promise<Buffer> {
    await this.privateBucket();
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(path);
    if (error || !data)
      throw new ServiceUnavailableException(
        'No se pudo descargar el archivo. Reintentá.',
      );
    return Buffer.from(await data.arrayBuffer());
  }
  async remove(path: string) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);
    if (error)
      throw new ServiceUnavailableException(
        'No se pudo limpiar una carga pendiente.',
      );
  }
}
