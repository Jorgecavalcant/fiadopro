import React from 'react';

const PrivacyPolicy: React.FC = () => {
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
        Política de Privacidade
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>
        Tech 42 LTDA
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          1. Dados que usamos
        </h2>
        <p>
          Usamos os dados necessários para a conta do lojista e para os registros que ele
          escolhe fazer no caderno: nome, e-mail e, se informado, telefone e foto do lojista;
          nome, telefone, valores de fiados e pagamentos dos clientes cadastrados pelo lojista.
          Para entrar com Google e enviar notificações, também podem ser usados dados de login
          e o identificador do aparelho. CPF ou CNPJ é usado somente para assinar no site.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          2. Para que usamos os dados
        </h2>
        <p>
          O serviço existe para cumprir o contrato com o lojista: permitir que ele organize
          clientes, fiados e pagamentos. Os dados dos clientes são registrados porque o
          lojista pediu que o caderno guardasse essas informações. Também usamos dados para
          manter a conta, enviar notificações solicitadas, prestar atendimento e proteger o
          serviço.
        </p>
        <p>
          A pontualidade do cliente é um índice interno daquela loja, calculado a partir do
          histórico de pagamentos registrado pelo lojista. Não é consulta de crédito.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          3. Com quem compartilhamos dados
        </h2>
        <p>
          Não vendemos dados para publicidade. Compartilhamos apenas o necessário para operar
          o serviço:
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>OpenRouter:</strong> nome e saldo do cliente, somente quando o lojista usa
            a análise com inteligência artificial.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Asaas:</strong> CPF ou CNPJ e dados da assinatura, somente para assinaturas
            feitas no site.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Google/Firebase:</strong> login Google e dados para notificações, inclusive
            o identificador do aparelho.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Hetzner:</strong> hospedagem do serviço e armazenamento dos dados.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Resend:</strong> envio de e-mails do serviço.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          4. Exclusão e prazo de retenção
        </h2>
        <p>
          Ao cancelar, a conta do lojista é desativada na hora. Os clientes, fiados e pagamentos
          daquela loja são apagados em até 30 dias. Durante esse período, esses registros
          permanecem no servidor e o lojista não consegue usar a conta.
        </p>
        <p>
          Para excluir a conta, use Meu Perfil → Zona de Perigo → Cancelar Conta no app.
          Também é possível pedir pelo e-mail{' '}
          <a href="mailto:contato@tech42.com.br" style={{ color: '#4f46e5' }}>
            contato@tech42.com.br
          </a>
          , inclusive para pedir a exclusão dos registros antes dos 30 dias. Cobranças já
          emitidas, backups até sua rotação e registros mínimos de segurança podem permanecer
          por mais tempo.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          5. Seus direitos
        </h2>
        <p>
          Você pode pedir acesso, correção, exclusão ou uma cópia dos dados relacionados à sua
          conta. Para isso, use os recursos do app ou escreva para o contato abaixo.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
          6. Contato
        </h2>
        <p>
          Para dúvidas ou pedidos relacionados à privacidade, escreva para Tech 42 LTDA:
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>E-mail:</strong>{' '}
          <a href="mailto:contato@tech42.com.br" style={{ color: '#4f46e5' }}>
            contato@tech42.com.br
          </a>
        </p>
      </section>

      <div
        style={{
          borderTop: '1px solid #e2e8f0',
          paddingTop: 24,
          marginTop: 40,
          fontSize: 13,
          color: '#94a3b8',
        }}
      >
        <p>Tech 42 LTDA</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
