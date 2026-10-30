import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FILE_LIMIT_BYTES, ImageRuleError, REQUEST_LIMIT, readImage, readMultipartFile, reencodeImage } from './sponsorImage.js';
import { cnpjDigits, cpfDigits, emailAddress, maskDocument, phoneDigits } from './sponsorParty.js';
import { SponsorRuleError } from './sponsors.js';

function png(width: number, height: number): Buffer {
  const file = Buffer.alloc(32);
  file.write('89504e470d0a1a0a0000000d49484452', 'hex');
  file.writeUInt32BE(width, 16);
  file.writeUInt32BE(height, 20);
  return file;
}

describe('arte e documento do patrocinador', () => {
  it('aceita PNG dentro do limite e recusa SVG, GIF, HTML e imagem grande', () => {
    expect(readImage(png(358, 92))).toEqual({ type: 'image/png', width: 358, height: 92 });
    expect(() => readImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toThrow(ImageRuleError);
    expect(() => readImage(Buffer.from('GIF89a'))).toThrow(ImageRuleError);
    expect(() => readImage(Buffer.from('<html><body></body></html>'))).toThrow(ImageRuleError);
    expect(() => readImage(png(4001, 10))).toThrow(/4000/);
    expect(() => readImage(Buffer.alloc(2 * 1024 * 1024 + 1, 1))).toThrow(/2 MB/);
    const exact = Buffer.alloc(FILE_LIMIT_BYTES);
    png(8, 8).copy(exact);
    expect(readImage(exact)).toEqual({ type: 'image/png', width: 8, height: 8 });
    expect(() => readImage(Buffer.concat([exact, Buffer.from([0])]))).toThrow(/2 MB/);
    expect(REQUEST_LIMIT).toBe('2.5mb');
    expect(FILE_LIMIT_BYTES).toBe(2 * 1024 * 1024);
  });

  it('regrava a imagem sem GPS e recalcula o hash', async () => {
    const source = await sharp({
      create: { width: 20, height: 10, channels: 3, background: { r: 180, g: 20, b: 20 } },
    })
      .jpeg()
      .withMetadata({
        orientation: 6,
        exif: { IFD0: { ImageDescription: 'GPS-TESTE-COORD' } },
      })
      .toBuffer();
    expect(source.includes(Buffer.from('GPS-TESTE-COORD'))).toBe(true);
    const before = await sharp(source).metadata();
    expect(before.exif || before.orientation).toBeTruthy();
    const out = await reencodeImage(source);
    const after = await sharp(out).metadata();
    expect(after.exif).toBeUndefined();
    expect(out.includes(Buffer.from('GPS-TESTE-COORD'))).toBe(false);
    expect(createHash('sha256').update(out).digest('hex')).not.toBe(
      createHash('sha256').update(source).digest('hex'),
    );
    const read = readImage(out);
    expect(read.type).toBe('image/jpeg');
    expect(read.width).toBe(10);
    expect(read.height).toBe(20);
    expect(after.orientation).toBeUndefined();
  });

  it('lê o arquivo de um envio multipart', () => {
    const body = Buffer.from(
      '--limite\r\nContent-Disposition: form-data; name="slot"\r\n\r\nfaixa\r\n--limite\r\nContent-Disposition: form-data; name="arquivo"; filename="arte.png"\r\nContent-Type: image/svg+xml\r\n\r\nPNGDATA\r\n--limite--',
    );
    const parsed = readMultipartFile(body, 'multipart/form-data; boundary=limite');
    expect(parsed.fields.slot).toBe('faixa');
    expect(parsed.file.toString()).toBe('PNGDATA');
  });

  it('valida CPF e CNPJ sem repetir o valor no erro', () => {
    expect(cpfDigits('390.533.447-05')).toBe('39053344705');
    expect(cnpjDigits('11.222.333/0001-81')).toBe('11222333000181');
    expect(maskDocument('39053344705')).toBe('***.***.***-05');
    expect(maskDocument('11222333000181')).toBe('**.***.***/0001-81');
    expect(phoneDigits('(62) 90000-0000')).toBe('62900000000');
    expect(emailAddress('TESTE@exemplo.test')).toBe('teste@exemplo.test');
    try {
      cpfDigits('111.111.111-11');
      throw new Error('aceitou');
    } catch (error) {
      expect(error).toBeInstanceOf(SponsorRuleError);
      expect((error as Error).message).toBe('Confira o CPF.');
      expect((error as Error).message).not.toContain('111');
    }
  });
});
