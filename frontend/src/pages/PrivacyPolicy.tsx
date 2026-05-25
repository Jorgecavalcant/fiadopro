import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4f46e5', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          ← Voltar ao Fiado Pro
        </a>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Política de Privacidade</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>Vigência a partir de 17/04/2026 | Tech 42 LTDA</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>1. Dados Coletados</h2>
        <p>O Fiado Pro coleta os seguintes dados pessoais:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}><strong>Do lojista (usuário do app):</strong> nome completo e endereço de e-mail.</li>
          <li style={{ marginBottom: 6 }}><strong>Dos clientes do lojista:</strong> nome, número de telefone e histórico de crédito informal (fiados) registrado pelo próprio lojista.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>2. Finalidade do Tratamento</h2>
        <p>Os dados são coletados exclusivamente para viabilizar o gerenciamento de crédito informal entre o comerciante e seus clientes, incluindo o registro de fiados, controle de pagamentos e comunicação via WhatsApp.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>3. Base Legal (LGPD)</h2>
        <p>O tratamento dos dados pessoais tem como base legal o <strong>consentimento do titular</strong>, nos termos do Art. 7º, inciso I, da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>4. Retenção dos Dados</h2>
        <p>Os dados são mantidos enquanto a conta do lojista estiver ativa no Fiado Pro. Após o cancelamento da conta ou solicitação expressa de exclusão, os dados serão eliminados conforme o Art. 18 da LGPD.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>5. Compartilhamento de Dados</h2>
        <p>Os dados <strong>não são vendidos, alugados ou compartilhados</strong> com terceiros para fins comerciais ou publicitários. O compartilhamento ocorre apenas com os seguintes provedores de infraestrutura, estritamente necessários para o funcionamento do serviço:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}><strong>Hetzner Online GmbH</strong> — hospedagem do servidor VPS</li>
          <li style={{ marginBottom: 6 }}><strong>Resend</strong> — envio de e-mails transacionais</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>6. Direitos do Titular (Art. 18, LGPD)</h2>
        <p>O titular dos dados tem direito a, a qualquer momento:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}><strong>Acesso</strong> — consultar quais dados estão armazenados</li>
          <li style={{ marginBottom: 6 }}><strong>Correção</strong> — solicitar a atualização de dados incorretos</li>
          <li style={{ marginBottom: 6 }}><strong>Exclusão</strong> — solicitar a eliminação de seus dados</li>
          <li style={{ marginBottom: 6 }}><strong>Portabilidade</strong> — solicitar a exportação dos dados em formato legível</li>
        </ul>
        <p style={{ marginTop: 12 }}>Esses direitos podem ser exercidos diretamente pelo app ou por meio do e-mail de contato abaixo.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>7. Contato</h2>
        <p>Para dúvidas, solicitações ou exercício de direitos relacionados à privacidade, entre em contato com o Encarregado de Proteção de Dados (DPO) da Tech 42 LTDA:</p>
        <p style={{ marginTop: 8 }}>
          <strong>E-mail:</strong>{' '}
          <a href="mailto:contato@tech42.com.br" style={{ color: '#4f46e5' }}>contato@tech42.com.br</a>
        </p>
      </section>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24, marginTop: 40, fontSize: 13, color: '#94a3b8' }}>
        <p>Tech 42 LTDA — CNPJ registrado. Esta política pode ser atualizada com aviso prévio de 30 dias.</p>
        <p>Última atualização: 17/04/2026</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
