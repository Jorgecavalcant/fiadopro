import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { query } from '../config/database.js';
import { readImage, reencodeImage, type ImageKind } from '../domain/sponsorImage.js';
import { assertPublicHttps, cleanText } from '../domain/sponsors.js';
import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../middleware/auth.js';
import { insertAuditEntry, withTransaction } from './adminAudit.js';

export function artAuditState(mediaId: string, creativeId: string): Record<string, string> {
  return { media_id: mediaId, creative_id: creativeId, resumo: 'arte enviada' };
}

export const MEDIA_SQL = `SELECT m.conteudo, m.content_type, m.sha256, k.status
       FROM sponsor_media m
       JOIN sponsor_creatives c ON c.media_id = m.id
       JOIN sponsor_contracts k ON k.id = c.contract_id
      WHERE m.id = $1
      ORDER BY CASE
        WHEN k.status = 'ativo'
         AND k.inicio <= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
         AND k.fim >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN 0
        WHEN k.status = 'ativo' THEN 1
        ELSE 2
      END, k.inicio DESC
      LIMIT 1`;

const FILE_NAME: Record<ImageKind, string> = {
  'image/jpeg': 'arte.jpg',
  'image/png': 'arte.png',
  'image/webp': 'arte.webp',
};

function frame(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function readerIsAdmin(req: AuthRequest): Promise<boolean> {
  const token = req.cookies?.fiado_token;
  if (!token) return false;
  try {
    const payload = verifyToken(token);
    const role = await query(
      `SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [payload.sub],
    );
    return role.rows[0]?.role === 'admin';
  } catch {
    return false;
  }
}

export async function sendSponsorMedia(req: AuthRequest, res: Response) {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(404, 'Arte não encontrada.', 'NOT_FOUND');
  }
  const found = await query(MEDIA_SQL, [id]);
  const row = found.rows[0];
  if (!row) throw new ApiError(404, 'Arte não encontrada.', 'NOT_FOUND');
  const type = String(row.content_type);
  if (!(type in FILE_NAME)) throw new ApiError(404, 'Arte não encontrada.', 'NOT_FOUND');
  if (row.status !== 'ativo' && !(await readerIsAdmin(req))) {
    throw new ApiError(404, 'Arte não encontrada.', 'NOT_FOUND');
  }
  const hash = String(row.sha256);
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${FILE_NAME[type as ImageKind]}"`);
  res.setHeader('ETag', `"${hash}"`);
  res.setHeader('Cache-Control', row.status === 'ativo' ? 'public, max-age=86400' : 'private, no-store');
  if (req.headers['if-none-match'] === `"${hash}"`) {
    res.status(304).end();
    return;
  }
  res.send(row.conteudo);
}

export async function storeSponsorMedia(
  contractId: string,
  file: Buffer,
  fields: Record<string, string>,
  adminId: string,
) {
  const prepared = await reencodeImage(file);
  const image = readImage(prepared);
  const slot = fields.slot === 'tela_cheia' ? 'tela_cheia' : fields.slot === 'faixa' ? 'faixa' : null;
  if (!slot) throw new ApiError(400, 'Escolha a faixa ou a tela cheia.', 'VALIDATION');
  const link = assertPublicHttps(fields.link_destino || '');
  const alt = cleanText(fields.texto_alt || '', 160, 'o texto alternativo');
  const zoom = frame(fields.zoom, 1, 1, 3);
  const x = frame(fields.x, 50, 0, 100);
  const y = frame(fields.y, 50, 0, 100);
  const hash = createHash('sha256').update(prepared).digest('hex');
  return withTransaction(async (sql) => {
    const contract = await sql(`SELECT slots, status FROM sponsor_contracts WHERE id = $1`, [contractId]);
    const row = contract.rows[0];
    if (!row) throw new ApiError(404, 'Contrato não encontrado.', 'NOT_FOUND');
    if (row.status === 'vencido' || row.status === 'cancelado') {
      throw new ApiError(409, 'Contrato encerrado não troca de criativo. Renove.', 'OFF_AIR');
    }
    const slots = row.slots as string[];
    if (!slots.includes(slot)) throw new ApiError(400, 'O criativo precisa usar um espaço do contrato.', 'VALIDATION');
    const media = await sql(
      `INSERT INTO sponsor_media (conteudo, content_type, byte_size, largura, altura, sha256)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [prepared, image.type, prepared.length, image.width, image.height, hash],
    );
    const mediaId = String(media.rows[0].id);
    const mediaUrl = `/api/sponsors/media/${mediaId}`;
    const current = await sql(
      `SELECT id FROM sponsor_creatives WHERE contract_id = $1 AND slot = $2 ORDER BY ordem LIMIT 1`,
      [contractId, slot],
    );
    let creativeId = '';
    if (current.rows[0]) {
      creativeId = String(current.rows[0].id);
      await sql(
        `UPDATE sponsor_creatives
            SET tipo = 'imagem', media_url = $2, media_origem = 'upload', media_id = $3,
                link_destino = $4, texto_alt = $5, titulo = $5,
                enquadramento_zoom = $6, enquadramento_x = $7, enquadramento_y = $8, updated_at = NOW()
          WHERE id = $1`,
        [creativeId, mediaUrl, mediaId, link, alt, zoom, x, y],
      );
    } else {
      const inserted = await sql(
        `INSERT INTO sponsor_creatives
           (contract_id, tipo, slot, media_url, media_origem, media_id, link_destino, titulo, texto_alt,
            enquadramento_zoom, enquadramento_x, enquadramento_y)
         VALUES ($1, 'imagem', $2, $3, 'upload', $4, $5, $6, $6, $7, $8, $9)
         RETURNING id`,
        [contractId, slot, mediaUrl, mediaId, link, alt, zoom, x, y],
      );
      creativeId = String(inserted.rows[0].id);
    }
    await insertAuditEntry(sql, {
      adminId,
      action: 'SPONSOR_ART',
      targetUserId: null,
      reason: null,
      note: null,
      beforeState: {},
      afterState: artAuditState(mediaId, creativeId),
      keepWhileOrderStands: false,
    });
    return { media_id: mediaId, media_url: mediaUrl, largura: image.width, altura: image.height, slot };
  });
}
