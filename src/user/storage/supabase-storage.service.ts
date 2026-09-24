import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket: string;
  private readonly client: ReturnType<typeof createClient>;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key =
      this.configService.get<string>('SUPABASE_SECRET_KEY') ??
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL y SUPABASE_SECRET_KEY deben estar definidas.',
      );
    }

    this.bucket =
      this.configService.get<string>('SUPABASE_PROFILE_PHOTOS_BUCKET') ??
      'Bond';

    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async upload(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Error de Supabase Storage al subir: ${error.message}`);
      throw new InternalServerErrorException(
        'No se pudo guardar la imagen de perfil.',
      );
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);

    return data.publicUrl;
  }

  async getRandomDefaultGroupImage(): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list('groups/defaults', {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      this.logger.error(
        `Error de Supabase Storage al listar imágenes de grupos: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'No se pudieron obtener las imágenes predeterminadas de grupos.',
      );
    }

    const images = data.filter(
      (file) => file.id !== null && /\.(jpe?g|png|webp)$/i.test(file.name),
    );

    if (images.length === 0) {
      throw new InternalServerErrorException(
        'No hay imágenes predeterminadas de grupos disponibles.',
      );
    }

    const image = images[Math.floor(Math.random() * images.length)];
    const path = `groups/defaults/${image.name}`;
    const { data: publicUrl } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return publicUrl.publicUrl;
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      this.logger.error(
        `Error de Supabase Storage al eliminar: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'No se pudo eliminar la imagen de perfil anterior.',
      );
    }
  }
}
