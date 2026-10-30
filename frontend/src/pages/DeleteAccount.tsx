import React from 'react';

const DeleteAccount: React.FC = () => {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#1e293b',
        lineHeight: 1.7,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#4f46e5',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Voltar
        </a>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
        Excluir conta e dados
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>
        Tech 42 LTDA
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          Como excluir sua conta
        </h2>
        <p>
          No app, acesse Meu Perfil → Zona de Perigo → Cancelar Conta e siga as instruções.
          Se você entrou somente com Google e já está conectado, confirme digitando CANCELAR.
          Se sua conta tem senha, confirme digitando sua senha.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          O que acontece com seus dados
        </h2>
        <p>
          A conta fica desativada. CPF e Pix saem agora. O nome, o e-mail, o telefone e o
          login ficam guardados para você voltar na mesma conta em até 30 dias.
        </p>
        <p>
          Os lançamentos desta conta são apagados depois desse prazo.
          Durante esses 30 dias, dá para consultar o histórico se a outra pessoa ainda
          entra no sistema, mas não fazer um lançamento novo.
        </p>
        <p>
          Uma cobrança já emitida, um backup até sua rotação e um registro mínimo de segurança
          podem permanecer por mais de 30 dias.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          Pedir a exclusão antes de 30 dias
        </h2>
        <p>
          Para pedir que os clientes, fiados e pagamentos sejam apagados antes desse prazo,
          escreva para{' '}
          <a href="mailto:contato@tech42.com.br">contato@tech42.com.br</a>.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          Política de Privacidade
        </h2>
        <p>
          Saiba mais na{' '}
          <a href="/privacidade">Política de Privacidade</a>.
        </p>
      </section>

      <footer style={{ marginTop: 48, fontSize: 14, color: '#64748b' }}>
        Tech 42 LTDA
      </footer>
    </div>
  );
};

export default DeleteAccount;
