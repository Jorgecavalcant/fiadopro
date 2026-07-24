import React from 'react';

const HelpView = () => {
  const [activeSection, setActiveSection] = React.useState<'manual' | 'faq' | 'support'>('manual');

  const manualItems = [
    {
      title: 'Cadastro de Clientes',
      content:
        'Como adicionar e gerenciar clientes no FiadoPro. Vá em "Clientes" → clique em "Adicionar Cliente" → preencha nome, telefone e outras informações. O cadastro é salvo automaticamente.',
    },
    {
      title: 'Registrar Dívida (Fiado)',
      content:
        'Para registrar que você passou mercadoria fiado para um cliente: vá no perfil do cliente → clique em "Nova Compra" → informe o valor e descrição → confirme. O saldo devedor do cliente é atualizado automaticamente.',
    },
    {
      title: 'Registrar Pagamento',
      content:
        'Quando o cliente pagar: perfil do cliente → "Registrar Pagamento" → informe o valor e método (Pix, Dinheiro, Cartão) → confirme.',
    },
    {
      title: 'Devoluções (A Pagar)',
      content:
        'Se um cliente devolveu mercadoria ou pagou a mais: perfil do cliente → "Devolução" → informe o valor. O cliente aparecerá automaticamente na aba "A Pagar". Lá você pode "Devolver" (registrar pagamento ao cliente) ou "Abater" (incorporar como lucro).',
    },
    {
      title: 'Score de Crédito',
      content:
        'Cada cliente recebe uma pontuação de 0 a 1000 calculada automaticamente com base no histórico de pagamentos, pontualidade e frequência. Score ≥ 800 = Excelente, 600-799 = Bom, 400-599 = Regular, < 400 = Ruim.',
    },
    {
      title: 'Parcelamento',
      content:
        'Ao registrar uma nova compra/dívida, marque "Compra parcelada", escolha o número de parcelas (2-24x) e opcionalmente adicione juros compostos mensais.',
    },
    {
      title: 'Eventos (Racha/Divisão)',
      content:
        'Para dividir contas entre grupos: vá em "Eventos" → "Novo Evento" → adicione participantes e os itens consumidos → o sistema calcula quanto cada um deve.',
    },
    {
      title: 'Abatimento',
      content:
        'Registre quando o cliente pagar com serviço, troca ou produto: perfil do cliente → "Abatimento" → descreva a forma de pagamento.',
    },
    {
      title: 'Notificações',
      content:
        'Quando um cliente registra pagamento pendente pelo sistema (funcionalidade futura), aparece em "Notificações" aguardando sua aprovação ou rejeição.',
    },
    {
      title: 'Insights IA (PRO)',
      content:
        'No perfil do cliente, clique em "Análise IA" para obter um relatório inteligente sobre o comportamento de pagamento deste cliente. Disponível apenas no Plano PRO.',
    },
    {
      title: 'Minhas Despesas',
      content:
        'Registre suas despesas operacionais (aluguel, fornecedores, etc.) para controle financeiro pessoal.',
    },
    {
      title: 'Extrato',
      content:
        'No perfil do cliente, clique no ícone de impressora para gerar um extrato completo em formato imprimível com todos os lançamentos.',
    },
    {
      title: 'Botão de Atalho (FAB)',
      content:
        'O botão flutuante (ícone de +) no canto inferior direito abre o menu de acesso rápido para lançar dívidas ou registrar pagamentos sem precisar entrar no perfil do cliente.',
    },
    {
      title: 'Exportar via WhatsApp',
      content:
        'No perfil do cliente, clique no ícone do WhatsApp para enviar um resumo do saldo e transações diretamente pelo WhatsApp.',
    },
    {
      title: 'Backup dos Dados',
      content:
        'Os dados são salvos localmente no seu dispositivo. Nas configurações do perfil, você pode exportar todos os dados em formato JSON para fazer backup.',
    },
  ];

  const faqItems = [
    {
      q: 'Os dados ficam salvos se eu fechar o app?',
      a: 'Sim! Todos os dados são salvos automaticamente no armazenamento local do seu dispositivo (localStorage). Não é necessária conexão com internet para usar o FiadoPro.',
    },
    {
      q: 'Posso usar em mais de um dispositivo?',
      a: 'Na versão atual, os dados são salvos localmente em cada dispositivo. Para usar em múltiplos dispositivos, utilize a função de Exportar/Importar dados nas configurações do perfil.',
    },
    {
      q: 'O que é o Plano PRO?',
      a: 'O Plano PRO desbloqueia: até 500 clientes (vs. 20 no gratuito), eventos ilimitados, Insights de IA por cliente, e sem propagandas. Consulte os planos disponíveis em "Upgrade para PRO" na barra lateral.',
    },
    {
      q: 'Como funciona o Score de Crédito?',
      a: 'O score (0-1000) é calculado automaticamente com base em: histórico de pagamentos, pontualidade, quantidade de transações, e tempo como cliente. Quanto mais o cliente paga em dia, maior o score.',
    },
    {
      q: 'O que é "Abatimento"?',
      a: 'Abatimento é quando o cliente paga de forma não monetária — por exemplo, com serviço prestado, produto trocado, ou qualquer outra forma que reduza a dívida sem ser um pagamento em dinheiro.',
    },
    {
      q: 'Como registrar uma devolução de mercadoria?',
      a: 'No perfil do cliente, clique no botão azul "Devolução", informe o valor da mercadoria devolvida. Se o cliente não tiver saldo devedor, ele aparecerá na aba "A Pagar" indicando que você deve devolver dinheiro a ele.',
    },
    {
      q: 'Consigo imprimir o extrato do cliente?',
      a: 'Sim! No perfil do cliente, na seção de transações, clique no ícone de impressora. O sistema abrirá uma nova aba com o extrato formatado. Ative popups no navegador se solicitado.',
    },
    {
      q: 'Como funciona o parcelamento?',
      a: 'Ao registrar uma nova compra, ative "Compra parcelada", escolha de 2 a 24 parcelas e opcionalmente adicione juros compostos. O sistema cria automaticamente as parcelas individuais e rastreia os pagamentos.',
    },
  ];

  const sectionStyle = (id: 'manual' | 'faq' | 'support') => ({
    padding: '9px 20px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    background: activeSection === id ? '#6366F1' : 'transparent',
    color: activeSection === id ? 'white' : 'var(--fp-muted)',
    transition: 'background 150ms, color 150ms',
  });

  return (
    <div className="fp-view-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Section switcher */}
      <div
        className="fp-card"
        style={{ padding: '10px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        <button style={sectionStyle('manual')} onClick={() => setActiveSection('manual')}>
          Manual de Uso
        </button>
        <button style={sectionStyle('faq')} onClick={() => setActiveSection('faq')}>
          Perguntas Frequentes
        </button>
        <button style={sectionStyle('support')} onClick={() => setActiveSection('support')}>
          Suporte
        </button>
      </div>

      {/* Manual */}
      {activeSection === 'manual' && (
        <div className="fp-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--fp-text)', marginBottom: 6 }}>
            Manual de Uso
          </h3>
          <p style={{ fontSize: 13, color: 'var(--fp-muted)', marginBottom: 24 }}>
            Guia completo de todas as funcionalidades do FiadoPro.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {manualItems.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '18px 0',
                  borderBottom: i < manualItems.length - 1 ? '1px solid var(--fp-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: '#EEF2FF',
                      color: '#6366F1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 12,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <p
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: 'var(--fp-text)',
                        marginBottom: 4,
                      }}
                    >
                      {item.title}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--fp-muted)', lineHeight: 1.6 }}>
                      {item.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeSection === 'faq' && (
        <div className="fp-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--fp-text)', marginBottom: 6 }}>
            Perguntas Frequentes
          </h3>
          <p style={{ fontSize: 13, color: 'var(--fp-muted)', marginBottom: 24 }}>
            Dúvidas mais comuns sobre o FiadoPro.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {faqItems.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '18px 0',
                  borderBottom: i < faqItems.length - 1 ? '1px solid var(--fp-border)' : 'none',
                }}
              >
                <p
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    color: 'var(--fp-text)',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: '#6366F1', marginRight: 8 }}>P:</span>
                  {item.q}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--fp-muted)',
                    lineHeight: 1.6,
                    paddingLeft: 20,
                  }}
                >
                  <span style={{ color: '#10B981', fontWeight: 800, marginRight: 8 }}>R:</span>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support */}
      {activeSection === 'support' && (
        <div className="fp-card" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--fp-text)', marginBottom: 6 }}>
            Suporte
          </h3>
          <p style={{ fontSize: 13, color: 'var(--fp-muted)', marginBottom: 28 }}>
            Precisa de ajuda? Entre em contato com nossa equipe!
          </p>

          <div
            style={{
              background: '#EEF2FF',
              borderRadius: 20,
              padding: 28,
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#6366F1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg
                width="28"
                height="28"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <p style={{ fontWeight: 900, fontSize: 16, color: '#4338CA', marginBottom: 8 }}>
              Suporte por E-mail
            </p>
            <p style={{ fontSize: 13, color: '#6366F1', marginBottom: 20 }}>
              suportejc.planejamento@gmail.com
            </p>
            <a
              href="mailto:suportejc.planejamento@gmail.com?subject=Suporte%20FiadoPro"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#6366F1',
                color: 'white',
                padding: '12px 28px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                transition: 'opacity 150ms',
              }}
            >
              Enviar E-mail de Suporte
            </a>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 16, padding: 20 }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--fp-text)', marginBottom: 8 }}>
              Informacoes sobre o atendimento:
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <li style={{ fontSize: 13, color: 'var(--fp-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: '#6366F1', fontWeight: 800, flexShrink: 0 }}>•</span>
                Atendimento via e-mail, de segunda a sexta, das 9h às 18h.
              </li>
              <li style={{ fontSize: 13, color: 'var(--fp-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: '#6366F1', fontWeight: 800, flexShrink: 0 }}>•</span>
                Prazo de resposta: até 1 dia útil.
              </li>
              <li style={{ fontSize: 13, color: 'var(--fp-muted)', display: 'flex', gap: 8 }}>
                <span style={{ color: '#6366F1', fontWeight: 800, flexShrink: 0 }}>•</span>
                Descreva detalhadamente seu problema ou dúvida para agilizar o atendimento.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpView;