// Shared interactive state — simple React context with mutation helpers.

const initialClientes = [
  { id: 1, nome: 'Juliana Barbosa',    tel: '(81) 9 9234-1120', inic: 'JB', score: 'alto',  ultima: 'ontem' },
  { id: 2, nome: 'Marcos Vinícius',    tel: '(81) 9 8812-0047', inic: 'MV', score: 'alto',  ultima: '2 dias' },
  { id: 3, nome: 'Dona Tereza',        tel: '(81) 9 9611-2208', inic: 'DT', score: 'médio', ultima: '5 dias' },
  { id: 4, nome: 'Ricardo Alencar',    tel: '(81) 9 9002-5518', inic: 'RA', score: 'alto',  ultima: 'hoje' },
  { id: 5, nome: 'Seu Antônio',        tel: '(81) 9 8477-3391', inic: 'SA', score: 'baixo', ultima: '12 dias' },
  { id: 6, nome: 'Pâmela Rodrigues',   tel: '(81) 9 9715-4402', inic: 'PR', score: 'médio', ultima: '4 dias' },
  { id: 7, nome: 'Eduardo Nóbrega',    tel: '(81) 9 8133-9910', inic: 'EN', score: 'baixo', ultima: '8 dias' },
  { id: 8, nome: 'Família Cavalcanti', tel: '(81) 9 9288-7720', inic: 'FC', score: 'alto',  ultima: 'ontem' },
];

// Lançamentos. `tipo`: 'fiado' (aumenta saldo) | 'pagamento' (diminui saldo).
// Datas relativas pro protótipo.
const initialLancamentos = [
  { id: 101, clienteId: 1, tipo: 'fiado',     valor: 412.80, descricao: 'Compras da semana',   quando: Date.now() - 1000*60*60*18 },
  { id: 102, clienteId: 2, tipo: 'fiado',     valor: 238.50, descricao: 'Rações + produtos',    quando: Date.now() - 1000*60*60*50 },
  { id: 103, clienteId: 3, tipo: 'fiado',     valor: 1250.00,descricao: 'Feira do mês',         quando: Date.now() - 1000*60*60*24*6 },
  { id: 104, clienteId: 4, tipo: 'fiado',     valor: 86.40,  descricao: 'Pão + leite',          quando: Date.now() - 1000*60*60*4 },
  { id: 105, clienteId: 5, tipo: 'fiado',     valor: 540.00, descricao: 'Mercado do mês',       quando: Date.now() - 1000*60*60*24*14 },
  { id: 106, clienteId: 6, tipo: 'fiado',     valor: 322.10, descricao: 'Compras semanais',     quando: Date.now() - 1000*60*60*24*4 },
  { id: 107, clienteId: 7, tipo: 'fiado',     valor: 402.30, descricao: 'Mercadorias',          quando: Date.now() - 1000*60*60*24*10 },
  { id: 108, clienteId: 8, tipo: 'fiado',     valor: 595.40, descricao: 'Feira grande',         quando: Date.now() - 1000*60*60*20 },
  { id: 109, clienteId: 1, tipo: 'pagamento', valor: 85.00,  descricao: 'Parcial',              quando: Date.now() - 1000*60*12 },
  { id: 110, clienteId: 4, tipo: 'pagamento', valor: 120.00, descricao: 'Quitação parcial',     quando: Date.now() - 1000*60*60*3 },
  { id: 111, clienteId: 6, tipo: 'pagamento', valor: 200.00, descricao: 'Pagamento via Pix',    quando: Date.now() - 1000*60*60*24 },
];

// Prazos de vencimento (dias a partir da criação do fiado)
const PRAZO_DIAS = 15;

const StoreCtx = React.createContext(null);

function StoreProvider({ children }) {
  const [clientes, setClientes] = React.useState(initialClientes);
  const [lancamentos, setLancamentos] = React.useState(initialLancamentos);
  const [toast, setToast] = React.useState(null); // {text, tone}

  const showToast = React.useCallback((text, tone = 'success') => {
    setToast({ text, tone, id: Date.now() });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const saldoDoCliente = React.useCallback((clienteId) => {
    return lancamentos
      .filter(l => l.clienteId === clienteId)
      .reduce((acc, l) => acc + (l.tipo === 'fiado' ? l.valor : -l.valor), 0);
  }, [lancamentos]);

  const statusCliente = React.useCallback((clienteId) => {
    // olha o fiado mais antigo não quitado → calcula dias desde criação
    const saldo = saldoDoCliente(clienteId);
    if (saldo <= 0.01) return { label: 'em dia', tone: 'success', dias: 0 };
    const fiados = lancamentos.filter(l => l.clienteId === clienteId && l.tipo === 'fiado').sort((a,b) => a.quando - b.quando);
    if (fiados.length === 0) return { label: 'em dia', tone: 'success', dias: 0 };
    const primeiro = fiados[0];
    const idade = (Date.now() - primeiro.quando) / (1000*60*60*24);
    const restante = PRAZO_DIAS - idade;
    if (restante < 0) return { label: `atrasado ${Math.floor(-restante)}d`, tone: 'error', dias: Math.floor(-restante) };
    if (restante < 4) return { label: restante < 1 ? 'vence hoje' : `vence em ${Math.ceil(restante)}d`, tone: 'warning', dias: Math.ceil(restante) };
    return { label: 'em dia', tone: 'success', dias: Math.floor(restante) };
  }, [lancamentos, saldoDoCliente]);

  const kpis = React.useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let aReceber = 0, atrasado = 0, recebidoMes = 0;
    clientes.forEach(c => {
      const s = saldoDoCliente(c.id);
      aReceber += Math.max(0, s);
      const st = statusCliente(c.id);
      if (st.tone === 'error') atrasado += Math.max(0, s);
    });
    lancamentos.forEach(l => {
      if (l.tipo === 'pagamento') {
        const d = new Date(l.quando);
        if (d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
          recebidoMes += l.valor;
        }
      }
    });
    // Pad recebidoMes with a historical base so the prototype looks plausible
    return { aReceber, atrasado, recebidoMes: recebidoMes + 5505, clientesAtivos: clientes.length };
  }, [clientes, lancamentos, saldoDoCliente, statusCliente]);

  const addFiado = (clienteId, valor, descricao) => {
    const id = Date.now();
    setLancamentos(ls => [{ id, clienteId, tipo: 'fiado', valor, descricao: descricao || 'Novo fiado', quando: Date.now() }, ...ls]);
    const c = clientes.find(x => x.id === clienteId);
    showToast(`Fiado de ${brl(valor)} registrado para ${c.nome}`, 'success');
    return id;
  };

  const addPagamento = (clienteId, valor, descricao) => {
    const id = Date.now();
    setLancamentos(ls => [{ id, clienteId, tipo: 'pagamento', valor, descricao: descricao || 'Pagamento', quando: Date.now() }, ...ls]);
    const c = clientes.find(x => x.id === clienteId);
    showToast(`Pagamento de ${brl(valor)} recebido de ${c.nome.split(' ')[0]}`, 'success');
    return id;
  };

  const addCliente = (nome, tel) => {
    const inic = nome.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
    const id = Date.now();
    setClientes(cs => [...cs, { id, nome, tel, inic, score: 'médio', ultima: 'agora' }]);
    showToast(`${nome} adicionado aos clientes`, 'success');
    return id;
  };

  const cobrar = (clienteId) => {
    const c = clientes.find(x => x.id === clienteId);
    showToast(`Cobrança enviada a ${c.nome.split(' ')[0]} via WhatsApp`, 'success');
  };

  const lancamentosDo = (clienteId) => lancamentos.filter(l => l.clienteId === clienteId).sort((a,b) => b.quando - a.quando);

  const recent = [...lancamentos].sort((a,b) => b.quando - a.quando).slice(0, 10);

  const api = {
    clientes, lancamentos, saldoDoCliente, statusCliente, kpis,
    addFiado, addPagamento, addCliente, cobrar,
    lancamentosDo, recent, toast,
  };

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

const useStore = () => React.useContext(StoreCtx);

function formatRelative(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff/60)} min`;
  if (diff < 3600*24) return `há ${Math.floor(diff/3600)}h`;
  if (diff < 3600*24*7) return `há ${Math.floor(diff/3600/24)}d`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

Object.assign(window, { StoreProvider, useStore, StoreCtx, formatRelative, PRAZO_DIAS });
