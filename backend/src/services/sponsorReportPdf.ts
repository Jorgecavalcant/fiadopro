import PDFDocument from 'pdfkit';
import { ratio } from './sponsorReads.js';

type ReportRow = { slot: string; plano: string; exibicoes: number; cliques: number; ctr: number };
type ReportDay = { dia: string; exibicoes: number; cliques: number };

export type SponsorReport = {
  nome: string;
  inicio: string;
  fim: string;
  from: string;
  to: string;
  rows: ReportRow[];
  days: ReportDay[];
};

function brDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
}

export function renderSponsorPdf(report: SponsorReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const views = report.rows.reduce((sum, row) => sum + row.exibicoes, 0);
    const clicks = report.rows.reduce((sum, row) => sum + row.cliques, 0);
    doc.fillColor('#2b2f77').font('Helvetica-Bold').fontSize(18).text('Fiado Pro');
    doc.fillColor('#1a1a1a').font('Helvetica').fontSize(14).text('Resultados do patrocínio');
    doc.moveDown(0.4);
    doc.fontSize(12).text(report.nome);
    doc.fontSize(10).fillColor('#5c5c5c').text(`Contrato ${brDate(report.inicio)} a ${brDate(report.fim)}`);
    doc.text(`Período ${brDate(report.from)} a ${brDate(report.to)}`);
    doc.moveDown(0.6);
    doc.fillColor('#1a1a1a').fontSize(12);
    doc.text(`Exibições: ${views}`);
    doc.text(`Cliques: ${clicks}`);
    doc.text(`CTR: ${percent(ratio(clicks, views))}`);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').text('Por espaço e plano');
    doc.font('Helvetica').fontSize(10);
    for (const row of report.rows) {
      const slot = row.slot === 'tela_cheia' ? 'Tela cheia' : 'Faixa';
      const plano = row.plano === 'pro' ? 'Pro' : 'Free';
      doc.text(`${slot} · ${plano} · ${row.exibicoes} exibições · ${row.cliques} cliques · ${percent(row.ctr)}`);
    }
    if (report.rows.length === 0) doc.text('Nenhuma contagem neste período.');

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(12).text('Por dia');
    const days = report.days.slice(-62);
    const max = Math.max(1, ...days.map((day) => day.exibicoes));
    const originY = doc.y + 90;
    const barW = Math.max(2, Math.min(8, (500 - days.length) / Math.max(days.length, 1)));
    days.forEach((day, index) => {
      const height = Math.max(1, (day.exibicoes / max) * 70);
      doc.save();
      doc.fillColor('#d9dbea').rect(48 + index * (barW + 2), originY - height, barW, height).fill();
      doc.restore();
    });
    const clickMax = Math.max(1, ...days.map((day) => day.cliques));
    doc.save();
    doc.strokeColor('#2b2f77').lineWidth(1.2);
    days.forEach((day, index) => {
      const x = 48 + index * (barW + 2) + barW / 2;
      const y = originY - (day.cliques / clickMax) * 70;
      if (index === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    });
    if (days.length > 0) doc.stroke();
    doc.restore();
    doc.y = originY + 16;
    doc.fillColor('#5c5c5c').font('Helvetica').fontSize(9);
    doc.text('Barras: exibições. Linha: cliques.');
    doc.moveDown(1);
    doc.fillColor('#1a1a1a').fontSize(10).text('Só contagens. Nenhum dado de cliente entra no relatório.');
    doc.end();
  });
}
