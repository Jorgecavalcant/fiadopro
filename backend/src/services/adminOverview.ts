import { z } from 'zod';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { query } from '../config/database.js';

export const OVERVIEW_PRESETS = ['7', '30', '90', '365'] as const;
export const OVERVIEW_TYPES = ['DEBT', 'PAYMENT', 'REFUND', 'ABATIMENTO'] as const;

export type OverviewPreset = (typeof OVERVIEW_PRESETS)[number];
export type OverviewType = (typeof OVERVIEW_TYPES)[number];
export type OverviewFormat = 'pdf' | 'xlsx';

const ZONE = 'America/Sao_Paulo';

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use AAAA-MM-DD.')
  .refine((value) => isRealDate(value), 'Data inválida.');

export const OverviewQuerySchema = z
  .object({
    preset: z.enum(OVERVIEW_PRESETS).optional(),
    from: dateField.optional(),
    to: dateField.optional(),
    type: z.enum(OVERVIEW_TYPES).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPreset = data.preset !== undefined;
    const hasFrom = data.from !== undefined;
    const hasTo = data.to !== undefined;
    if (hasPreset && (hasFrom || hasTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use o atalho de período ou as duas datas, não os dois.',
      });
    }
    if (!hasPreset && (!hasFrom || !hasTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o período: 7, 30, 90, 365 ou as datas inicial e final.',
      });
    }
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data inicial não pode ser depois da data final.',
      });
    }
  });

export const OverviewExportQuerySchema = OverviewQuerySchema.and(
  z.object({
    format: z.enum(['pdf', 'xlsx'], {
      errorMap: () => ({ message: 'Formato inválido. Use pdf ou xlsx.' }),
    }),
  }),
);

export interface OverviewQuery {
  preset?: OverviewPreset;
  from?: string;
  to?: string;
  type?: OverviewType;
}

export interface OverviewReport {
  from: string;
  to: string;
  preset: OverviewPreset | null;
  type: OverviewType | null;
  usuariosAtivos: number;
  clientes: number;
  lancamentos: number;
  volumeConfirmado: number;
  contasBloqueadas: number;
  contasEncerradas: number;
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function one(value: unknown): string | undefined {
  if (Array.isArray(value)) return one(value[0]);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function queryFields(source: unknown) {
  const raw = (source ?? {}) as Record<string, unknown>;
  return {
    preset: one(raw.preset),
    from: one(raw.from),
    to: one(raw.to),
    type: one(raw.type),
  };
}

export function parseOverviewQuery(source: unknown): OverviewQuery {
  return OverviewQuerySchema.parse(queryFields(source));
}

export function parseOverviewExportQuery(source: unknown): OverviewQuery & { format: OverviewFormat } {
  const raw = (source ?? {}) as Record<string, unknown>;
  return OverviewExportQuerySchema.parse({
    ...queryFields(source),
    format: one(raw.format),
  });
}

export function saoPauloToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveOverviewRange(filters: OverviewQuery, now = new Date()) {
  if (filters.preset) {
    const to = saoPauloToday(now);
    const from = addCalendarDays(to, -(Number(filters.preset) - 1));
    return { from, to, preset: filters.preset };
  }
  return { from: filters.from as string, to: filters.to as string, preset: null as OverviewPreset | null };
}

function period(column: string): string {
  return `${column} >= ($1::date::timestamp AT TIME ZONE '${ZONE}') AND ${column} < (($2::date + 1)::timestamp AT TIME ZONE '${ZONE}')`;
}

function asCount(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function asMoney(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export async function loadAdminOverview(filters: OverviewQuery, now = new Date()): Promise<OverviewReport> {
  const range = resolveOverviewRange(filters, now);
  const rangeParams = [range.from, range.to];
  const type = filters.type ?? null;
  const txParams = type ? [...rangeParams, type] : rangeParams;
  const typeSql = type ? ' AND type = $3' : '';

  const [usuariosAtivos, clientes, lancamentos, volumeConfirmado, contasBloqueadas, contasEncerradas] =
    await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
           FROM users
          WHERE is_active = true
            AND deleted_at IS NULL
            AND ${period('created_at')}
            /* overview:usuariosAtivos */`,
        rangeParams,
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM customers
          WHERE deleted_at IS NULL
            AND ${period('created_at')}
            /* overview:clientes */`,
        rangeParams,
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM transactions
          WHERE ${period('occurred_at')}${typeSql}
            /* overview:lancamentos */`,
        txParams,
      ),
      query(
        `SELECT COALESCE(SUM(amount), 0)::float8 AS total
           FROM transactions
          WHERE status = 'CONFIRMED'
            AND ${period('occurred_at')}${typeSql}
            /* overview:volumeConfirmado */`,
        txParams,
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM users
          WHERE is_active = false
            AND deleted_at IS NULL
            AND ${period('COALESCE(blocked_at, updated_at)')}
            /* overview:contasBloqueadas */`,
        rangeParams,
      ),
      query(
        `SELECT COUNT(*)::int AS total
           FROM users
          WHERE ${period('deleted_at')}
            /* overview:contasEncerradas */`,
        rangeParams,
      ),
    ]);

  return {
    from: range.from,
    to: range.to,
    preset: range.preset,
    type,
    usuariosAtivos: asCount(usuariosAtivos.rows[0]?.total),
    clientes: asCount(clientes.rows[0]?.total),
    lancamentos: asCount(lancamentos.rows[0]?.total),
    volumeConfirmado: asMoney(volumeConfirmado.rows[0]?.total),
    contasBloqueadas: asCount(contasBloqueadas.rows[0]?.total),
    contasEncerradas: asCount(contasEncerradas.rows[0]?.total),
  };
}

export function overviewExportState(report: OverviewReport, format: OverviewFormat) {
  const type = report.type;
  if (report.preset) return { format, preset: report.preset, type };
  return { format, from: report.from, to: report.to, type };
}

export function overviewLines(report: OverviewReport): string[] {
  return [
    `Periodo: ${report.from} a ${report.to}`,
    `Tipo: ${report.type ?? 'todos'}`,
    `usuariosAtivos: ${report.usuariosAtivos}`,
    `clientes: ${report.clientes}`,
    `lancamentos: ${report.lancamentos}`,
    `volumeConfirmado: ${report.volumeConfirmado}`,
    `contasBloqueadas: ${report.contasBloqueadas}`,
    `contasEncerradas: ${report.contasEncerradas}`,
  ];
}

export function renderOverviewPdf(report: OverviewReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(16).text('Visao geral');
    doc.moveDown(0.4);
    doc.fontSize(12);
    for (const line of overviewLines(report)) doc.text(line);
    doc.end();
  });
}

export async function renderOverviewXlsx(report: OverviewReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fiado Pro';
  const sheet = workbook.addWorksheet('Visao geral');
  for (const line of overviewLines(report)) sheet.addRow([line]);
  const raw = await workbook.xlsx.writeBuffer({
    zip: { compression: 'STORE' },
  } as unknown as Parameters<ExcelJS.Xlsx['writeBuffer']>[0]);
  return Buffer.from(raw);
}
