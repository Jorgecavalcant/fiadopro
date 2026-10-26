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
          ← Voltar ao Fiado Pro
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
          Acesse <a href="https://www.fiadopro.com.br">https://www.fiadopro.com.br</a>, abra
          Meu Perfil e, na Zona de Perigo, toque em Cancelar Conta. Escolha um motivo, digite a
          palavra CANCELAR e confirme com sua senha. Em seguida, o app mostrará “Excluir minha
          conta”.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          O que a exclusão faz
        </h2>
        <p>
          A conta é desativada, o nome é alterado para “Conta removida” e o e-mail
          é substituído por um endereço anônimo. O telefone, a foto, a senha e o vínculo com o
          Google são apagados. A sessão é encerrada e um e-mail de confirmação é enviado para o
          endereço original. No aparelho, o app limpa a cópia local.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          Registros de fiado
        </h2>
        <p>
          A exclusão da conta não apaga automaticamente do servidor os registros de fiado,
          incluindo nomes e telefones dos clientes do lojista e os valores.
        </p>
        <p>
          Para solicitar também a exclusão desses registros, ou se você entrou somente com
          Google e não consegue concluir a etapa da senha, escreva para{' '}
          <a href="mailto:contato@tech42.com.br">contato@tech42.com.br</a> com o e-mail da
          conta.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          Política de Privacidade
        </h2>
        <p>
          Saiba mais na{' '}
          <a href="https://www.fiadopro.com.br/privacidade">
            Política de Privacidade
          </a>
          .
        </p>
      </section>

      <footer style={{ marginTop: 48, fontSize: 14, color: '#64748b' }}>
        Tech 42 LTDA
      </footer>
    </div>
  );
};

export default DeleteAccount;
