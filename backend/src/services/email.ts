import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'Fiado Pro <onboarding@resend.dev>';

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${process.env.APP_URL || 'https://www.fiadopro.com.br'}?reset_token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Redefinir senha - Fiado Pro',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#4f46e5">Fiado Pro</h2>
        <p>Recebemos uma solicitacao para redefinir sua senha.</p>
        <p>Clique no botao abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
          Redefinir minha senha
        </a>
        <p style="color:#6b7280;font-size:13px">Se voce nao solicitou isso, ignore este e-mail. Sua senha nao sera alterada.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">Fiado Pro - Controle suas fiados com inteligencia</p>
      </div>
    `,
  });
}

export async function sendAccountDeletionEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Conta excluida - Fiado Pro',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#4f46e5">Fiado Pro</h2>
        <p>Ola, ${name}.</p>
        <p>Sua conta no Fiado Pro foi <strong>excluida com sucesso</strong>.</p>
        <p>Todos os seus dados pessoais foram removidos do nosso sistema, conforme exigido pela LGPD (Lei 13.709/2018).</p>
        <p style="color:#6b7280;font-size:13px">Se voce nao solicitou essa exclusao, entre em contato conosco imediatamente respondendo este e-mail.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">Fiado Pro - Controle suas fiados com inteligencia</p>
      </div>
    `,
  });
}
