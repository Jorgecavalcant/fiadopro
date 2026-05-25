import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4f46e5', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          ← Voltar ao Fiado Pro
        </a>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Termos de Uso</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>Vigência a partir de 17/04/2026 | Tech 42 LTDA</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>1. Descrição do Serviço</h2>
        <p>O <strong>Fiado Pro</strong> é um aplicativo de gerenciamento de crédito informal desenvolvido pela Tech 42 LTDA. Ele permite que pequenos comerciantes registrem fiados, acompanhem pagamentos e se comuniquem com seus clientes de forma organizada e digital.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>2. Licença de Uso</h2>
        <p>A Tech 42 LTDA concede ao usuário uma licença de uso <strong>limitada, não exclusiva e intransferível</strong> para acessar e utilizar o Fiado Pro exclusivamente para fins pessoais e comerciais legítimos, de acordo com estes Termos de Uso.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>3. Responsabilidades do Usuário</h2>
        <p>Ao utilizar o Fiado Pro, o usuário compromete-se a:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>Utilizar o aplicativo de acordo com a legislação brasileira vigente.</li>
          <li style={{ marginBottom: 6 }}>Não utilizar a plataforma para fins fraudulentos, ilegais ou que violem direitos de terceiros.</li>
          <li style={{ marginBottom: 6 }}>Manter a confidencialidade de suas credenciais de acesso.</li>
          <li style={{ marginBottom: 6 }}>Garantir que os dados inseridos sobre seus clientes sejam precisos e obtidos de forma lícita.</li>
          <li style={{ marginBottom: 6 }}>Obter o consentimento de seus clientes antes de registrar seus dados pessoais no aplicativo.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>4. Limitação de Responsabilidade</h2>
        <p>A Tech 42 LTDA fornece a plataforma tecnológica para o gerenciamento de crédito informal. <strong>O comerciante é o único responsável pelas decisões de crédito tomadas</strong>, incluindo a concessão, cobrança e negociação de fiados com seus clientes.</p>
        <p style={{ marginTop: 12 }}>A Tech 42 LTDA não se responsabiliza por perdas financeiras decorrentes do uso da plataforma ou de decisões de crédito tomadas pelo usuário.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>5. Cancelamento</h2>
        <p>O usuário pode cancelar sua conta e solicitar a exclusão de seus dados a qualquer momento, diretamente pelo aplicativo ou pelo e-mail <a href="mailto:contato@tech42.com.br" style={{ color: '#4f46e5' }}>contato@tech42.com.br</a>.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>6. Alterações nos Termos</h2>
        <p>A Tech 42 LTDA pode alterar estes Termos de Uso a qualquer momento, com <strong>aviso prévio de 30 dias</strong> por e-mail ou notificação no aplicativo. O uso continuado do Fiado Pro após o prazo de aviso implica na aceitação dos novos termos.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>7. Lei Aplicável e Foro</h2>
        <p>Estes Termos de Uso são regidos pelas leis da <strong>República Federativa do Brasil</strong>. Fica eleito o foro da <strong>Comarca de São Paulo — SP</strong> para dirimir quaisquer controvérsias decorrentes deste instrumento.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>8. Contato</h2>
        <p>Dúvidas sobre estes termos podem ser enviadas para:</p>
        <p style={{ marginTop: 8 }}>
          <strong>E-mail:</strong>{' '}
          <a href="mailto:contato@tech42.com.br" style={{ color: '#4f46e5' }}>contato@tech42.com.br</a>
        </p>
        <p><strong>Tech 42 LTDA</strong> — Brasil</p>
      </section>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24, marginTop: 40, fontSize: 13, color: '#94a3b8' }}>
        <p>Estes termos estão disponíveis em <a href="/termos" style={{ color: '#4f46e5' }}>fiadopro.com.br/termos</a> e podem ser baixados a qualquer momento.</p>
        <p>Última atualização: 17/04/2026</p>
      </div>
    </div>
  );
};

export default TermsOfService;
