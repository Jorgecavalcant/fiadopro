import React from 'react';
import { isAndroidApp } from '../utils/androidStore';

const HelpView = () => {
  const [activeSection, setActiveSection] = React.useState<'manual' | 'faq' | 'support'>('manual');

  const manualItems = [
    {
      title: 'Menu',
      content:
        'O menu mostra Painel, Clientes, Dividir Conta, Aprovações, Minhas Dívidas, Notificações, A Pagar (Devoluções), Minhas Despesas, Gestão de Clientes, Insights IA e Ajuda & Suporte.',
    },
    {
      title: 'Novo Cliente',
      content:
        'Abra Clientes e toque em Novo Cliente. Preencha nome e telefone. O cadastro fica salvo neste aparelho.',
    },
    {
      title: 'Nova Despesa',
      content:
        'No perfil do cliente, toque em Nova Despesa. Informe o valor e a descrição. A dívida desse cliente aumenta.',
    },
    {
      title: 'Registrar Pagamento',
      content:
        'Quando a pessoa pagar, abra o perfil e toque em Registrar Pagamento. Informe o valor e a forma: Pix, cartão de crédito, cartão de débito ou compensação.',
    },
    {
      title: 'Abatimento',
      content:
        'Toque em Abatimento quando o pagamento for serviço, troca ou produto. Descreva o que entrou. O valor sai da dívida.',
    },
    {
      title: 'Devolução',
      content:
        'No perfil, toque em Devolução e informe o valor. Se sobrar saldo a favor, o cliente aparece em A Pagar (Devoluções). Lá os botões são Devolver e Abater. No perfil, os botões desse saldo são Acerto de Lucro e Devolver p/ Cliente.',
    },
    {
      title: 'Pontualidade do cliente',
      content:
        'A pontualidade desta loja sai do histórico de pagamento. Quem paga em dia aparece melhor.',
    },
    {
      title: 'Compra parcelada',
      content:
        'Em Nova Despesa, marque Compra parcelada. Escolha de 2 a 24 parcelas. Se quiser, marque Cobrar juros compostos.',
    },
    {
      title: 'Dividir Conta',
      content:
        'Abra Dividir Conta e toque em Novo Evento. Use Adicionar Item e Adicionar Pessoa. Toque no nome do item, embaixo de cada pessoa, para marcar o que ela consumiu. Dividir igualmente entre todos marca todos os itens para todas as pessoas. O vencimento é opcional. Se ficar em branco, a dívida fica sem vencimento. Toque em Confirmar Divisão para lançar.',
    },
    {
      title: 'Minhas Despesas',
      content:
        'No menu Minhas Despesas ficam os gastos da loja, como aluguel e fornecedor. A sua parte num rateio também pode aparecer aqui.',
    },
    {
      title: 'Extrato',
      content:
        'No perfil, em Extrato de Transações, toque no ícone de impressora. O extrato abre para imprimir, com data e hora no formato brasileiro.',
    },
    {
      title: 'Acesso Rápido',
      content:
        'O botão com + abre o Acesso Rápido. Lá estão Lançar Dívida e Receber Pagamento, sem abrir o perfil antes.',
    },
    {
      title: 'Enviar via WhatsApp',
      content:
        'No perfil do cliente, toque em Enviar via WhatsApp. A mensagem leva o resumo do saldo.',
    },
    {
      title: 'Análise IA',
      content:
        'No perfil, toque em Análise IA para ver um resumo do histórico de pagamento. Esse recurso faz parte do Plano Pro. Em Insights IA, o botão é Gerar Novas Dicas.',
    },
    {
      title: 'Notificações e Aprovações',
      content:
        'Notificações mostra o que ainda precisa da sua decisão. Os botões são Aprovar e Recusar. Aprovações mostra o que outra pessoa lançou e espera confirmação.',
    },
    {
      title: 'Meu Perfil',
      content:
        'Toque no seu nome, no fim do menu, para abrir Meu Perfil. Lá estão Exportar Dados, Importar Dados e Histórico de Alterações.',
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
      a: isAndroidApp()
        ? 'Se a sua conta já é PRO, você usa até 500 clientes, eventos ilimitados, Insights de IA e sem anúncios.'
        : 'O Plano Pro libera até 500 clientes, eventos ilimitados, Análise IA e a tela sem anúncio. No menu, o botão é Upgrade para PRO.',
    },
    {
      q: 'Como funciona a pontualidade do cliente?',
      a: 'A pontualidade do cliente nesta loja é baseada no histórico de pagamento em dia. Quanto mais o cliente paga em dia nesta loja, melhor aparece.',
    },
    {
      q: 'O que é "Abatimento"?',
      a: 'Abatimento é quando o cliente paga de forma não monetária — por exemplo, com serviço prestado, produto trocado, ou qualquer outra forma que reduza a dívida sem ser um pagamento em dinheiro.',
    },
    {
      q: 'Como registrar uma devolução de mercadoria?',
      a: 'No perfil do cliente, toque em Devolução e informe o valor. Se ficar saldo a favor, a pessoa aparece em A Pagar (Devoluções). Lá os botões são Devolver e Abater.',
    },
    {
      q: 'Consigo imprimir o extrato do cliente?',
      a: 'Sim! No perfil do cliente, na seção de transações, clique no ícone de impressora. O sistema abrirá uma nova aba com o extrato formatado. Ative popups no navegador se solicitado.',
    },
    {
      q: 'Como funciona o parcelamento?',
      a: 'Em Nova Despesa, marque Compra parcelada. Escolha de 2 a 24 parcelas. Se quiser, marque Cobrar juros compostos. Cada parcela aparece no extrato do cliente.',
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
