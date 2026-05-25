// Mobile prototype shell — handles navigation between screens with
// a subtle forward/back slide animation.

function MobilePrototype({ theme }) {
  const [tab, setTab] = React.useState('home');
  // Stack of modal-ish screens on top of the current tab:
  // each entry: { screen: 'detalhe'|'novoFiado'|'pagamento'|'novoCliente', clienteId?: number }
  const [stack, setStack] = React.useState([]);
  const [anim, setAnim] = React.useState(null); // {dir: 'push'|'pop', key}
  const { toast } = useStore();

  const navigate = React.useCallback((to) => {
    if (to.tab) setTab(to.tab);
    if (to.screen === null) {
      setAnim({ dir: 'pop', key: Date.now() });
      setTimeout(() => setStack(s => s.slice(0, -1)), 10);
      return;
    }
    if (to.screen) {
      setAnim({ dir: 'push', key: Date.now() });
      // If we're replacing (e.g. after submit we go to 'detalhe'), replace top
      setStack(s => {
        // collapse a form stack so "after register → detalhe" doesn't pile up
        if (to.screen === 'detalhe' && s.length > 0 && s[s.length - 1].screen !== 'detalhe') {
          return [...s.slice(0, -1), to];
        }
        return [...s, to];
      });
    }
  }, []);

  const top = stack[stack.length - 1];

  // Tab content
  const tabScreen = (() => {
    switch (tab) {
      case 'home':      return <PHome theme={theme} navigate={navigate}/>;
      case 'clientes':  return <PClientes theme={theme} navigate={navigate}/>;
      case 'atividade': return <PAtividade theme={theme}/>;
      case 'perfil':    return <PPerfil theme={theme}/>;
      default:          return null;
    }
  })();

  const modalScreen = top && (() => {
    switch (top.screen) {
      case 'detalhe':     return <PDetalhe theme={theme} navigate={navigate} clienteId={top.clienteId}/>;
      case 'novoFiado':   return <PNovoFiado theme={theme} navigate={navigate} clienteId={top.clienteId}/>;
      case 'pagamento':   return <PPagamento theme={theme} navigate={navigate} clienteId={top.clienteId}/>;
      case 'novoCliente': return <PNovoCliente theme={theme} navigate={navigate}/>;
      default:            return null;
    }
  })();

  const hideTabBar = !!top && ['novoFiado', 'pagamento', 'novoCliente'].includes(top.screen);

  return (
    <div style={{ ...fiadoThemeStyle(theme), position: 'relative', width: '100%', height: '100%', background: theme.bg, overflow: 'hidden' }}>
      <style>{`
        @keyframes fp-slide-in  { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fp-slide-out { from { transform: translateX(0); }    to { transform: translateX(100%); } }
        @keyframes fp-fade-in   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Base tab screen */}
      <div key={tab} style={{ position: 'absolute', inset: 0, animation: 'fp-fade-in 220ms ease-out' }}>
        {tabScreen}
      </div>

      {/* Stack of overlay screens */}
      {stack.map((s, i) => {
        const isTop = i === stack.length - 1;
        const isEntering = isTop && anim?.dir === 'push';
        return (
          <div key={`${s.screen}-${s.clienteId || ''}-${i}`} style={{
            position: 'absolute', inset: 0, zIndex: 20 + i, background: theme.bg,
            animation: isEntering ? 'fp-slide-in 260ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}>
            {i === stack.length - 1 ? modalScreen : null /* only render top to keep it light */}
          </div>
        );
      })}

      {/* Tab bar + FAB (on home tab) */}
      {!hideTabBar && (
        <>
          <PTabBar theme={theme} active={tab} onChange={(t) => { setStack([]); setTab(t); }}/>
          {tab === 'home' && stack.length === 0 && (
            <PFab theme={theme} onClick={() => navigate({ screen: 'novoFiado' })}/>
          )}
        </>
      )}

      {/* Toast — matches login flow style */}
      {toast && (
        <div key={toast.id} style={{
          position: 'absolute', bottom: hideTabBar ? 100 : 80, left: 16, right: 16,
          background: '#1a3f6f', color: '#fff', padding: '12px 16px', borderRadius: 14,
          fontSize: 13, fontWeight: 600, zIndex: 100,
          boxShadow: '0 8px 24px rgba(26,63,111,0.35)',
          animation: 'fp-fade-in 220ms ease-out',
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: toast.tone === 'success' ? '#1a7a4a' : '#c87820', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FPIcon name="check" size={12} color="#fff" stroke={2.5}/>
          </div>
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ─── Web companion — v2 visual identity ──────────────────────
function WebCompanion({ theme }) {
  const { clientes, saldoDoCliente, statusCliente, kpis, recent, cobrar, addPagamento } = useStore();
  const [selectedId, setSelectedId] = React.useState(clientes[0]?.id);

  const rows = clientes
    .map(c => ({ ...c, saldo: saldoDoCliente(c.id), status: statusCliente(c.id) }))
    .sort((a, b) => b.saldo - a.saldo);

  const sel = clientes.find(c => c.id === selectedId);
  const selSaldo = sel ? saldoDoCliente(sel.id) : 0;
  const selStatus = sel ? statusCliente(sel.id) : null;

  const COLORS = ['#c8783a', '#1a3f6f', '#7a5c9e', '#1a7a4a', '#c0392b', '#2558a0', '#5a3a8a', '#c87820'];

  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'grid', gridTemplateColumns: '220px 1fr 380px', color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>
      {/* Sidebar — navy */}
      <aside style={{ background: theme.primary, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ padding: '8px 4px 20px' }}>
          <FPLogo light size={28}/>
        </div>
        {[
          { icon: 'home', label: 'Painel', active: true },
          { icon: 'list', label: 'Clientes' },
          { icon: 'chart', label: 'Extrato' },
          { icon: 'whatsapp', label: 'Cobranças' },
          { icon: 'settings', label: 'Configurações' },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10,
            background: item.active ? 'rgba(255,255,255,0.15)' : 'transparent',
            color: item.active ? '#fff' : 'rgba(255,255,255,0.55)',
            fontSize: 13, fontWeight: item.active ? 600 : 500, cursor: 'pointer',
          }}>
            <FPIcon name={item.icon} size={16} stroke={1.8}/>
            {item.label}
          </div>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#fff' }}>CM</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Cristiane M.</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Mercearia da Cris</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ overflow: 'auto', background: theme.bg }}>
        {/* Header band */}
        <div style={{ background: theme.primary, padding: '20px 24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Segunda, 28 abr</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4 }}>Painel do dia</div>
            </div>
            <button style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', color: '#fff', padding: '9px 16px', borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FPIcon name="plus" size={14} color="#fff" stroke={2.5}/> Novo lançamento
            </button>
          </div>
        </div>

        <div style={{ padding: '0 24px 32px' }}>
          {/* KPI cards — overlapping band */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: -20, marginBottom: 20 }}>
            {[
              { k: 'A receber', v: brl(kpis.aReceber), t: '+12,4%', tc: 'success' },
              { k: 'Atrasados', v: brl(kpis.atrasado), t: '3 clientes', tc: 'error' },
              { k: 'Recebido em abril', v: brl(kpis.recebidoMes), t: '+8,2%', tc: 'success' },
            ].map(k => (
              <div key={k.k} style={{ background: theme.surface, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: `1px solid ${theme.divider}` }}>
                <div style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{k.k}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, fontVariantNumeric: 'tabular-nums', color: k.tc === 'error' ? theme.error : theme.text }}>{k.v}</div>
                <div style={{ fontSize: 11, color: k.tc === 'success' ? theme.success : theme.textSubtle, marginTop: 2, fontWeight: 600 }}>{k.t}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: theme.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${theme.divider}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${theme.divider}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>Clientes em aberto</div>
              <button style={{ background: 'transparent', border: `1.5px solid ${theme.border}`, color: theme.primary, padding: '6px 12px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <FPIcon name="filter" size={12} stroke={1.8}/> Filtrar
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr auto', gap: 10, padding: '10px 18px', fontSize: 10, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${theme.divider}` }}>
              <div>Cliente</div><div>Score</div><div>Status</div><div style={{ textAlign: 'right' }}>Saldo</div><div></div>
            </div>
            {rows.slice(0, 8).map((r, i) => {
              const sc = scoreColors(r.score, theme.mode);
              const isSel = r.id === selectedId;
              return (
                <div key={r.id} onClick={() => setSelectedId(r.id)} style={{
                  display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr auto', gap: 10,
                  padding: '12px 18px', borderBottom: i < rows.length - 1 ? `1px solid ${theme.divider}` : 'none',
                  alignItems: 'center', cursor: 'pointer',
                  background: isSel ? theme.primaryLight : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: COLORS[i % COLORS.length] + '22', border: `1.5px solid ${COLORS[i % COLORS.length]}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: COLORS[i % COLORS.length] }}>{r.inic}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{r.nome}</div>
                      <div style={{ fontSize: 10, color: theme.textSubtle }}>{r.tel}</div>
                    </div>
                  </div>
                  <div><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: sc.bg, color: sc.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{r.score}</span></div>
                  <div style={{ fontSize: 12, color: r.status.tone === 'error' ? theme.error : r.status.tone === 'warning' ? theme.warning : theme.textSubtle }}>{r.status.label}</div>
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.saldo > 0 ? (r.status.tone === 'error' ? theme.error : theme.text) : theme.textSubtle }}>{r.saldo > 0 ? brl(r.saldo) : '—'}</div>
                  <button onClick={(e) => { e.stopPropagation(); cobrar(r.id); }} style={{ background: 'transparent', border: `1.5px solid ${theme.border}`, padding: '6px 10px', borderRadius: 50, cursor: 'pointer', color: theme.primary, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                    <FPIcon name="whatsapp" size={11} stroke={1.8}/> Cobrar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Right rail */}
      <aside style={{ background: theme.surface, borderLeft: `1px solid ${theme.divider}`, overflow: 'auto' }}>
        {sel ? (
          <>
            <div style={{ background: theme.primary, padding: '20px 20px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: '#fff' }}>{sel.inic}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{sel.nome}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{sel.tel}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Saldo devedor</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{brl(Math.max(0, selSaldo))}</div>
                <div style={{ fontSize: 11, color: selStatus?.tone === 'error' ? '#fca5a5' : 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 2 }}>{selStatus?.label}</div>
              </div>
            </div>

            <div style={{ padding: '0 16px', marginTop: -16 }}>
              <div style={{ background: theme.surface, borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: `1px solid ${theme.divider}`, padding: '14px', display: 'flex', gap: 8 }}>
                <button onClick={() => selSaldo > 0 && addPagamento(sel.id, selSaldo, 'Quitação')} style={{ flex: 1, background: theme.primary, color: '#fff', border: 'none', padding: '10px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Receber total</button>
                <button onClick={() => cobrar(sel.id)} style={{ flex: 1, background: theme.surface, color: theme.primary, border: `1.5px solid ${theme.primary}`, padding: '10px', borderRadius: 50, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><FPIcon name="whatsapp" size={12} stroke={1.8}/> Cobrar</button>
              </div>

              <div style={{ fontSize: 11, color: theme.textSubtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, margin: '18px 0 8px' }}>Histórico</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: theme.surface, borderRadius: 14, overflow: 'hidden', border: `1px solid ${theme.divider}` }}>
                {recent.filter(r => r.clienteId === sel.id).slice(0, 6).map((a, i, arr) => (
                  <div key={a.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: a.tipo === 'pagamento' ? '#d1fae5' : theme.primaryLight, color: a.tipo === 'pagamento' ? theme.success : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FPIcon name={a.tipo === 'pagamento' ? 'arrow-down' : 'plus'} size={12} stroke={2}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{a.descricao}</div>
                        <div style={{ fontSize: 10, color: theme.textSubtle }}>{formatRelative(a.quando)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: a.tipo === 'pagamento' ? theme.success : theme.text, fontVariantNumeric: 'tabular-nums' }}>{a.tipo === 'pagamento' ? '−' : '+'}{brl(a.valor)}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ height: 1, background: theme.divider, marginLeft: 52 }}/>}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: theme.textSubtle, padding: 40 }}>Selecione um cliente</div>
        )}
      </aside>
    </div>
  );
}

Object.assign(window, { MobilePrototype, WebCompanion });
