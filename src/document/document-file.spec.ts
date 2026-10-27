import { validateDocumentFile, MAX_DOCUMENT_BYTES } from './document-file';

describe('Document signatures and size', () => {
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001',
    'hex',
  );
  const fixtures: [string, Buffer][] = [
    ['application/pdf', Buffer.from('%PDF-1.7\n%%EOF')],
    ['image/jpeg', Buffer.from([255, 216, 255, 224])],
    ['image/png', png],
    ['image/webp', Buffer.from('RIFF0000WEBPVP8 ')],
  ];
  it.each(fixtures)(
    'accepts %s with matching signature',
    (mimetype, buffer) => {
      expect(() => validateDocumentFile({ mimetype, buffer })).not.toThrow();
    },
  );
  it.each(fixtures)('rejects spoofed %s', (mimetype) => {
    expect(() =>
      validateDocumentFile({
        mimetype,
        buffer: Buffer.from('<html>fake</html>'),
      }),
    ).toThrow();
  });
  it('accepts exactly 10 MiB and rejects one extra byte', () => {
    const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES);
    buffer.write('%PDF-1.7');
    expect(() =>
      validateDocumentFile({ mimetype: 'application/pdf', buffer }),
    ).not.toThrow();
    expect(() =>
      validateDocumentFile({
        mimetype: 'application/pdf',
        buffer: Buffer.concat([buffer, Buffer.from('x')]),
      }),
    ).toThrow();
  });
  it('rejects missing, empty and unsupported files', () => {
    expect(() => validateDocumentFile()).toThrow();
    expect(() =>
      validateDocumentFile({
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(0),
      }),
    ).toThrow();
    expect(() =>
      validateDocumentFile({
        mimetype: 'image/svg+xml',
        buffer: Buffer.from('<svg/>'),
      }),
    ).toThrow();
  });
});
