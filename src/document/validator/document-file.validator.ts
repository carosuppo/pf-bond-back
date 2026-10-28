import { BadRequestException } from '@nestjs/common';
import { MAX_DOCUMENT_BYTES } from '../constants/document.constants';
import { DocumentFile } from '../interface/document-file.interface';

export function validateDocumentFile(
  file?: DocumentFile,
): asserts file is DocumentFile {
  if (!file || !file.buffer.length)
    throw new BadRequestException('Seleccioná un archivo.');
  if (file.buffer.length > MAX_DOCUMENT_BYTES)
    throw new BadRequestException('El archivo supera los 10 MB.');
  const b = file.buffer;
  const signatures: Record<string, boolean> = {
    'application/pdf':
      b.length >= 8 && b.subarray(0, 5).toString('ascii') === '%PDF-',
    'image/jpeg':
      b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    'image/png':
      b.length >= 24 &&
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      b.subarray(12, 16).toString('ascii') === 'IHDR',
    'image/webp':
      b.length >= 16 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(b.subarray(12, 16).toString('ascii')),
  };
  if (!signatures[file.mimetype])
    throw new BadRequestException(
      'Formato o firma inválida. Usá PDF, JPG, PNG o WebP.',
    );
}
