const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 4000;

export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp';

export class ImageRuleError extends Error {}

function fail(message: string): never {
  throw new ImageRuleError(message);
}

function pngSize(file: Buffer): { width: number; height: number } {
  if (file.length < 24 || file.toString('ascii', 12, 16) !== 'IHDR') fail('Envie JPG, PNG ou WebP.');
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

function jpegSize(file: Buffer): { width: number; height: number } {
  let index = 2;
  while (index + 8 < file.length) {
    if (file[index] !== 0xff) break;
    const marker = file[index + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      index += 2;
      continue;
    }
    const length = file.readUInt16BE(index + 2);
    if (length < 2) break;
    const startOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (startOfFrame) {
      return { width: file.readUInt16BE(index + 7), height: file.readUInt16BE(index + 5) };
    }
    index += 2 + length;
  }
  return fail('Envie JPG, PNG ou WebP.');
}

function webpSize(file: Buffer): { width: number; height: number } {
  const kind = file.toString('ascii', 12, 16);
  if (kind === 'VP8X' && file.length >= 30) {
    return {
      width: 1 + file.readUIntLE(24, 3),
      height: 1 + file.readUIntLE(27, 3),
    };
  }
  if (kind === 'VP8 ' && file.length >= 30) {
    return { width: file.readUInt16LE(26) & 0x3fff, height: file.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L' && file.length >= 25) {
    const bits = file.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return fail('Envie JPG, PNG ou WebP.');
}

export function readImage(file: Buffer): { type: ImageKind; width: number; height: number } {
  if (file.length === 0 || file.length > MAX_BYTES) fail('A imagem passa de 2 MB.');
  const head = file.subarray(0, 16).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<') || head.startsWith('gif8')) fail('Envie JPG, PNG ou WebP.');
  let type: ImageKind;
  let size: { width: number; height: number };
  if (file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) {
    type = 'image/jpeg';
    size = jpegSize(file);
  } else if (file[0] === 0x89 && file.toString('ascii', 1, 4) === 'PNG') {
    type = 'image/png';
    size = pngSize(file);
  } else if (file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP') {
    type = 'image/webp';
    size = webpSize(file);
  } else {
    return fail('Envie JPG, PNG ou WebP.');
  }
  if (size.width < 1 || size.height < 1 || size.width > MAX_EDGE || size.height > MAX_EDGE) {
    fail('A imagem passa de 4000 px de lado.');
  }
  return { type, width: size.width, height: size.height };
}

export function readMultipartFile(body: Buffer, contentType: string): { file: Buffer; fields: Record<string, string> } {
  const found = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!found) fail('Não consegui ler o envio.');
  const boundary = Buffer.from(`--${(found[1] || found[2]).trim()}`);
  const fields: Record<string, string> = {};
  let file: Buffer | null = null;
  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf(boundary, cursor);
    if (start === -1) break;
    const next = body.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    let chunk = body.subarray(start + boundary.length, next);
    if (chunk[0] === 13 && chunk[1] === 10) chunk = chunk.subarray(2);
    const split = chunk.indexOf('\r\n\r\n');
    if (split === -1) {
      cursor = next;
      continue;
    }
    const header = chunk.subarray(0, split).toString('utf8');
    let data = chunk.subarray(split + 4);
    if (data.length >= 2 && data[data.length - 2] === 13 && data[data.length - 1] === 10) {
      data = data.subarray(0, data.length - 2);
    }
    const name = /name="([^"]+)"/.exec(header)?.[1];
    if (name && /filename=/.test(header)) file = data;
    else if (name) fields[name] = data.toString('utf8');
    cursor = next;
  }
  if (!file) fail('Escolha o arquivo da arte.');
  return { file, fields };
}
