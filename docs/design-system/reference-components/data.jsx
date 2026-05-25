// Realistic Brazilian Fiado Pro data — used across all dashboards.

const fiadoData = {
  lojista: {
    nome: 'Cristiane Matos',
    estabelecimento: 'Mercearia da Cris',
    cidade: 'Recife · PE',
    avatar: 'CM',
  },
  kpis: {
    aReceber: 3847.50,
    aReceberTrend: +12.4,
    recebidoMes: 6210.00,
    recebidoTrend: +8.2,
    atrasado: 942.30,
    atrasadoTrend: -4.1,
    clientesAtivos: 47,
    clientesNovos: 3,
  },
  clientes: [
    { nome: 'Juliana Barbosa',   tel: '(81) 9 9234-1120', inic: 'JB', saldo: 412.80, score: 'alto',  status: 'em dia',       ultima: 'ontem' },
    { nome: 'Marcos Vinícius',    tel: '(81) 9 8812-0047', inic: 'MV', saldo: 238.50, score: 'alto',  status: 'em dia',       ultima: '2 dias' },
    { nome: 'Dona Tereza',       tel: '(81) 9 9611-2208', inic: 'DT', saldo: 1250.00,score: 'médio', status: 'vence em 3d',  ultima: '5 dias' },
    { nome: 'Ricardo Alencar',    tel: '(81) 9 9002-5518', inic: 'RA', saldo: 86.40,  score: 'alto',  status: 'em dia',       ultima: 'hoje' },
    { nome: 'Seu Antônio',        tel: '(81) 9 8477-3391', inic: 'SA', saldo: 540.00, score: 'baixo', status: 'atrasado 8d',  ultima: '12 dias' },
    { nome: 'Pâmela Rodrigues',   tel: '(81) 9 9715-4402', inic: 'PR', saldo: 322.10, score: 'médio', status: 'vence hoje',   ultima: '4 dias' },
    { nome: 'Eduardo Nóbrega',    tel: '(81) 9 8133-9910', inic: 'EN', saldo: 402.30, score: 'baixo', status: 'atrasado 3d',  ultima: '8 dias' },
    { nome: 'Família Cavalcanti', tel: '(81) 9 9288-7720', inic: 'FC', saldo: 595.40, score: 'alto',  status: 'em dia',       ultima: 'ontem' },
  ],
  atividade: [
    { tipo: 'pagamento',  quem: 'Juliana Barbosa',   valor: 85.00,  quando: 'há 12 min' },
    { tipo: 'lancamento', quem: 'Dona Tereza',       valor: 42.30,  quando: 'há 2 h' },
    { tipo: 'pagamento',  quem: 'Ricardo Alencar',   valor: 120.00, quando: 'há 3 h' },
    { tipo: 'lancamento', quem: 'Seu Antônio',       valor: 28.50,  quando: 'ontem · 18:42' },
    { tipo: 'pagamento',  quem: 'Pâmela Rodrigues',  valor: 200.00, quando: 'ontem · 11:20' },
    { tipo: 'lancamento', quem: 'Marcos Vinícius',   valor: 67.90,  quando: 'ontem · 09:05' },
  ],
  // 14-day sparkline of "a receber" (R$ em milhares)
  sparkline: [2.8, 3.1, 2.9, 3.4, 3.3, 3.5, 3.2, 3.6, 3.8, 3.5, 3.7, 3.9, 3.8, 3.85],
  // Distribuição por status (bar chart)
  distribuicao: [
    { label: 'Em dia',     pct: 62, cor: 'success' },
    { label: 'A vencer',   pct: 23, cor: 'warning' },
    { label: 'Atrasados',  pct: 15, cor: 'error'   },
  ],
  // Receitas últimos 6 meses (R$ em milhares)
  mensal: [
    { mes: 'Nov', valor: 4.2 },
    { mes: 'Dez', valor: 5.8 },
    { mes: 'Jan', valor: 4.9 },
    { mes: 'Fev', valor: 5.3 },
    { mes: 'Mar', valor: 5.9 },
    { mes: 'Abr', valor: 6.21 },
  ],
};

const brl = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlShort = (v) => {
  if (v >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + 'k';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

Object.assign(window, { fiadoData, brl, brlShort });
