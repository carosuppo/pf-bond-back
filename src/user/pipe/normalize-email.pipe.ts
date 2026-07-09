import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class NormalizeEmailPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (typeof value === 'string' && metadata.data === 'email') {
      return this.normalizeEmail(value);
    }

    if (
      value &&
      typeof value === 'object' &&
      'email' in value &&
      typeof value.email === 'string'
    ) {
      return {
        ...value,
        email: this.normalizeEmail(value.email),
      };
    }

    return value;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
