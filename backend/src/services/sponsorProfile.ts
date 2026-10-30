import { ApiError } from '../middleware/errorHandler.js';
import {
  cnpjDigits,
  cpfDigits,
  emailAddress,
  phoneDigits,
} from '../domain/sponsorParty.js';
import { cleanText, SponsorRuleError } from '../domain/sponsors.js';
import { query } from '../config/database.js';
import { insertAuditEntry, withTransaction } from './adminAudit.js';

export type SponsorProfile = {
  tipo_pessoa: 'pj' | 'pf';
  nome: string;
  razao_social: string | null;
  documento: string;
  categoria: string;
  endereco: string;
  cidade: string;
  uf: string;
  representante_nome: string | null;
  representante_cargo: string | null;
  telefone: string;
  email: string;
};

export function readProfile(input: {
  tipo_pessoa?: string;
  nome: string;
  razao_social?: string | null;
  documento?: string | null;
  categoria: string;
  endereco?: string | null;
  cidade: string;
  uf?: string | null;
  representante_nome?: string | null;
  representante_cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
}): SponsorProfile {
  try {
    const tipo = input.tipo_pessoa === 'pf' ? 'pf' : input.tipo_pessoa === 'pj' ? 'pj' : null;
    if (!tipo) throw new SponsorRuleError('Escolha pessoa jurídica ou pessoa física.');
    const uf = cleanText(input.uf || '', 2, 'a UF').toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) throw new SponsorRuleError('Informe a UF.');
    return {
      tipo_pessoa: tipo,
      nome: cleanText(input.nome, 80, 'o nome'),
      razao_social: tipo === 'pj' ? cleanText(input.razao_social || '', 120, 'a razão social') : null,
      documento: tipo === 'pj' ? cnpjDigits(input.documento || '') : cpfDigits(input.documento || ''),
      categoria: cleanText(input.categoria, 40, 'a categoria'),
      endereco: cleanText(input.endereco || '', 160, 'o endereço'),
      cidade: cleanText(input.cidade, 80, 'a cidade'),
      uf,
      representante_nome: tipo === 'pj' ? cleanText(input.representante_nome || '', 80, 'o representante') : null,
      representante_cargo: tipo === 'pj' ? cleanText(input.representante_cargo || '', 80, 'o cargo') : null,
      telefone: phoneDigits(input.telefone || ''),
      email: emailAddress(input.email || ''),
    };
  } catch (error) {
    if (error instanceof SponsorRuleError) throw new ApiError(400, error.message, 'VALIDATION');
    throw error;
  }
}

export async function loadSponsor(id: string) {
  const result = await query(
    `SELECT id, nome, categoria, cidade, tipo_pessoa, razao_social, documento, endereco, uf,
            representante_nome, representante_cargo, telefone, email
       FROM sponsors WHERE id = $1`,
    [id],
  );
  if (!result.rows[0]) throw new ApiError(404, 'Patrocinador não encontrado.', 'NOT_FOUND');
  return result.rows[0];
}

export async function saveSponsorProfile(adminId: string, id: string, profile: SponsorProfile) {
  return withTransaction(async (sql) => {
    const result = await sql(
      `UPDATE sponsors
          SET tipo_pessoa = $2, nome = $3, razao_social = $4, documento = $5, categoria = $6,
              endereco = $7, cidade = $8, uf = $9, representante_nome = $10, representante_cargo = $11,
              telefone = $12, email = $13, updated_at = NOW()
        WHERE id = $1
        RETURNING id`,
      [
        id,
        profile.tipo_pessoa,
        profile.nome,
        profile.razao_social,
        profile.documento,
        profile.categoria,
        profile.endereco,
        profile.cidade,
        profile.uf,
        profile.representante_nome,
        profile.representante_cargo,
        profile.telefone,
        profile.email,
      ],
    );
    if (!result.rows[0]) throw new ApiError(404, 'Patrocinador não encontrado.', 'NOT_FOUND');
    await insertAuditEntry(sql, {
      adminId,
      action: 'SPONSOR_UPDATE',
      targetUserId: null,
      reason: null,
      note: null,
      beforeState: { id },
      afterState: { id, resumo: 'dados do patrocinador alterados' },
      keepWhileOrderStands: false,
    });
    return result.rows[0];
  });
}
