// Detalhe + Novo Fiado + Pagamento + Clientes + Atividade + Perfil — v2 visual identity

function PDetalhe({ theme, navigate, clienteId }) {
  const { clientes, saldoDoCliente, statusCliente, lancamentosDo, cobrar } = useStore();
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return null;
  const saldo = saldoDoCliente(c.id);
  const status = statusCliente(c.id);
  const items = lancamentosDo(c.id);
  const sc = scoreColors(c.score, theme.mode);
  const overdue = status.tone === 'error';

  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Navy header band */}
      <div style={{ background: theme.primary, padding: '56px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate({ screen: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, padding: '4px 0' }}>
            <FPIcon name="chevron-left" size={20} color="rgba(255,255,255,0.8)" stroke={2}/> Voltar
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: '#fff' }}>{c.inic}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{c.nome}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{c.tel}</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Saldo devedor</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.8 }}>{brl(Math.max(0, saldo))}</div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 50, background: 'rgba(255,255,255,0.15)', fontSize: 12, fontWeight: 600, color: '#fff' }}>
            {status.label}
          </div>
        </div>
      </div>

      {/* Action card overlapping band */}
      <div style={{ background: theme.surface, margin: '0 16px', borderRadius: 16, padding: '14px', marginTop: -16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', gap: 10, position: 'relative', zIndex: 2 }}>
        <button onClick={() => navigate({ screen: 'pagamento', clienteId: c.id })} style={{ flex: 1, padding: '11px 10px', borderRadius: 12, border: `1.5px solid ${theme.primary}`, background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontWeight: 600, fontSize: 13, color: '#fff', cursor: 'pointer' }}>
          <FPIcon name="arrow-down" size={14} color="#fff" stroke={2.5}/> Receber
        </button>
        <button onClick={() => navigate({ screen: 'novoFiado', clienteId: c.id })} style={{ flex: 1, padding: '11px 10px', borderRadius: 12, border: `1.5px solid ${theme.border}`, background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontWeight: 600, fontSize: 13, color: theme.primary, cursor: 'pointer' }}>
          <FPIcon name="plus" size={14} color={theme.primary} stroke={2.5}/> Fiar
        </button>
        <button onClick={() => cobrar(c.id)} style={{ width: 44, borderRadius: 12, border: `1.5px solid ${theme.border}`, background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <FPIcon name="whatsapp" size={16} color={theme.primary} stroke={1.8}/>
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ background: theme.surface, margin: '10px 16px 0', borderRadius: 14, padding: '12px 16px', display: 'flex', gap: 0, border: `1px solid ${theme.divider}` }}>
        {[
          { k: 'Score', v: <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: sc.bg, color: sc.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.score}</span> },
          { k: 'Lançamentos', v: items.length },
          { k: 'Contato', v: c.ultima },
        ].map((s, i, a) => (
          <div key={s.k} style={{ flex: 1, borderRight: i < a.length - 1 ? `1px solid ${theme.divider}` : 'none', paddingRight: 12, paddingLeft: i > 0 ? 12 : 0 }}>
            <div style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.k}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* History */}
      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, margin: '16px 16px 8px' }}>Histórico</div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        <div style={{ background: theme.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${theme.divider}` }}>
          {items.map((it, i) => (
            <div key={it.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: it.tipo === 'pagamento' ? '#d1fae5' : theme.primaryLight, color: it.tipo === 'pagamento' ? theme.success : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FPIcon name={it.tipo === 'pagamento' ? 'arrow-down' : 'plus'} size={14} stroke={2}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{it.descricao}</div>
                  <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 1 }}>{formatRelative(it.quando)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: it.tipo === 'pagamento' ? theme.success : theme.text, fontVariantNumeric: 'tabular-nums' }}>
                  {it.tipo === 'pagamento' ? '−' : '+'}{brl(it.valor)}
                </div>
              </div>
              {i < items.length - 1 && <div style={{ height: 1, background: theme.divider, marginLeft: 60 }}/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Numeric keypad ───────────────────────────────────────────
function PKeypad({ value, onChange, theme }) {
  const press = (k) => {
    if (k === 'back') return onChange(value.slice(0, -1));
    if (k === '.' && value.includes(',')) return;
    if (k === '.') return onChange((value || '0') + ',');
    if (value === '0' && k !== ',') return onChange(k);
    onChange(value + k);
  };
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','back'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '4px 0 8px' }}>
      {keys.map(k => (
        <button key={k} onClick={() => press(k)} style={{
          height: 54, borderRadius: 12, background: theme.surface,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          border: `1px solid ${theme.divider}`,
          color: theme.text, fontSize: 22, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {k === 'back'
            ? <svg width="22" height="18" viewBox="0 0 24 20" fill="none" stroke={theme.primary} strokeWidth="2"><path d="M22 3H8L1 10l7 7h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><line x1="18" y1="8" x2="12" y2="14"/><line x1="12" y1="8" x2="18" y2="14"/></svg>
            : k === '.' ? ',' : k}
        </button>
      ))}
    </div>
  );
}

function ClientePicker({ theme, selected, onSelect }) {
  const { clientes } = useStore();
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0', marginTop: 8 }}>
      {clientes.map(c => {
        const isSel = selected?.id === c.id;
        return (
          <button key={c.id} onClick={() => onSelect(c)} style={{
            flexShrink: 0, background: isSel ? theme.primary : theme.surface, color: isSel ? '#fff' : theme.text,
            border: `1.5px solid ${isSel ? theme.primary : theme.border}`, borderRadius: 50, padding: '8px 14px 8px 8px',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: isSel ? 'rgba(255,255,255,0.2)' : theme.primaryLight, color: isSel ? '#fff' : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 10 }}>{c.inic}</div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Novo Fiado ───────────────────────────────────────────────
function PNovoFiado({ theme, navigate, clienteId }) {
  const { clientes, addFiado } = useStore();
  const [selected, setSelected] = React.useState(clientes.find(c => c.id === clienteId) || null);
  const [valor, setValor] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const numeric = parseFloat((valor || '0').replace(',', '.')) || 0;

  const submit = () => {
    if (!selected || numeric <= 0) return;
    addFiado(selected.id, numeric, desc || 'Novo fiado');
    navigate({ screen: 'detalhe', clienteId: selected.id });
  };

  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header band */}
      <div style={{ background: theme.primary, padding: '56px 20px 24px' }}>
        <button onClick={() => navigate({ screen: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, padding: '4px 0', marginBottom: 14 }}>
          <FPIcon name="chevron-left" size={20} color="rgba(255,255,255,0.8)" stroke={2}/> Voltar
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Novo fiado</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Registrar venda a prazo</div>
      </div>

      {/* Floating card */}
      <div style={{ background: theme.surface, margin: '0 16px', borderRadius: 16, padding: '20px 16px', marginTop: -16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8 }}>Valor</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: theme.text, marginTop: 6, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: 20, color: theme.textSubtle, marginRight: 4 }}>R$</span>{valor || '0'}
            <span style={{ color: theme.primary }}>|</span>
          </div>
        </div>
        <style>{`@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}`}</style>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Cliente</div>
        <ClientePicker theme={theme} selected={selected} onSelect={setSelected}/>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Descrição</div>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: feira da semana"
            style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }}/>
        </div>
      </div>

      <div style={{ padding: '12px 16px 28px', background: theme.bg, borderTop: `1px solid ${theme.divider}` }}>
        <PKeypad value={valor} onChange={setValor} theme={theme}/>
        <button onClick={submit} disabled={!selected || numeric <= 0} style={{
          width: '100%', background: (!selected || numeric <= 0) ? '#eceef2' : theme.primary,
          color: (!selected || numeric <= 0) ? '#9a9a9a' : '#fff',
          border: `1.5px solid ${(!selected || numeric <= 0) ? theme.border : 'transparent'}`,
          padding: '15px', borderRadius: 50, fontSize: 15, fontWeight: 600,
          cursor: (!selected || numeric <= 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>Registrar fiado</button>
      </div>
    </div>
  );
}

// ─── Pagamento ────────────────────────────────────────────────
function PPagamento({ theme, navigate, clienteId }) {
  const { clientes, saldoDoCliente, addPagamento } = useStore();
  const c = clientes.find(x => x.id === clienteId);
  const saldo = saldoDoCliente(clienteId);
  const [valor, setValor] = React.useState('');
  const numeric = parseFloat((valor || '0').replace(',', '.')) || 0;

  const quick = [saldo, saldo / 2, 50, 100].filter(v => v > 0.01);

  const submit = () => {
    if (!c || numeric <= 0) return;
    addPagamento(c.id, numeric, numeric >= saldo ? 'Quitação total' : 'Pagamento parcial');
    navigate({ screen: 'detalhe', clienteId: c.id });
  };

  if (!c) return null;
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: theme.primary, padding: '56px 20px 28px' }}>
        <button onClick={() => navigate({ screen: 'detalhe', clienteId: c.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, padding: '4px 0', marginBottom: 14 }}>
          <FPIcon name="chevron-left" size={20} color="rgba(255,255,255,0.8)" stroke={2}/> Voltar
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Receber pagamento</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{c.nome} · deve {brl(saldo)}</div>
      </div>

      <div style={{ background: theme.surface, margin: '0 16px', borderRadius: 16, padding: '20px 16px', marginTop: -16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8 }}>Recebendo</div>
        <div style={{ fontSize: 44, fontWeight: 700, color: theme.success, marginTop: 6, letterSpacing: -1.2, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontSize: 20, color: theme.textSubtle, marginRight: 4 }}>R$</span>{valor || '0'}
        </div>
        {numeric > 0 && numeric < saldo && <div style={{ fontSize: 12, color: theme.warning, marginTop: 4 }}>Restam {brl(saldo - numeric)}</div>}
        {numeric >= saldo && numeric > 0 && <div style={{ fontSize: 12, color: theme.success, marginTop: 4, fontWeight: 600 }}>✓ Quitação total</div>}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 0', overflowX: 'auto' }}>
        {quick.map((v, i) => (
          <button key={i} onClick={() => setValor(v.toFixed(2).replace('.', ','))} style={{
            flexShrink: 0, background: theme.surface, color: theme.primary, border: `1.5px solid ${theme.primary}`,
            borderRadius: 50, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>{i === 0 ? `Total · ${brlShort(v)}` : i === 1 ? `Metade · ${brlShort(v)}` : brlShort(v)}</button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '0 16px' }}/>
      <div style={{ padding: '12px 16px 28px', background: theme.bg, borderTop: `1px solid ${theme.divider}` }}>
        <PKeypad value={valor} onChange={setValor} theme={theme}/>
        <button onClick={submit} disabled={numeric <= 0} style={{
          width: '100%', background: numeric <= 0 ? '#eceef2' : theme.success,
          color: numeric <= 0 ? '#9a9a9a' : '#fff',
          border: `1.5px solid ${numeric <= 0 ? theme.border : 'transparent'}`,
          padding: '15px', borderRadius: 50, fontSize: 15, fontWeight: 600,
          cursor: numeric <= 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>Confirmar recebimento</button>
      </div>
    </div>
  );
}

function PNovoCliente({ theme, navigate }) {
  const { addCliente } = useStore();
  const [nome, setNome] = React.useState('');
  const [tel, setTel] = React.useState('');
  const submit = () => { if (!nome.trim()) return; addCliente(nome.trim(), tel); navigate({ screen: null, tab: 'clientes' }); };
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: theme.primary, padding: '56px 20px 28px' }}>
        <button onClick={() => navigate({ screen: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, padding: '4px 0', marginBottom: 14 }}>
          <FPIcon name="chevron-left" size={20} color="rgba(255,255,255,0.8)" stroke={2}/> Voltar
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Novo cliente</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Informe os dados do cliente</div>
      </div>
      <div style={{ background: theme.surface, margin: '0 16px', borderRadius: 16, padding: '20px 16px', marginTop: -16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8 }}>Nome completo</div>
          <input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Maria Silva"
            style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${nome ? theme.primary : theme.border}`, background: theme.bg, color: theme.text, fontSize: 15, outline: 'none', fontFamily: 'inherit', fontWeight: 500, boxSizing: 'border-box' }}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8 }}>WhatsApp</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${theme.border}`, borderRadius: 12, background: theme.bg, padding: '12px 14px' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted }}>🇧🇷 +55</span>
            <div style={{ width: 1, height: 18, background: theme.border }}/>
            <input value={tel} onChange={e => setTel(e.target.value)} placeholder="(81) 9 0000-0000" type="tel"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: theme.text }}/>
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }}/>
      <div style={{ padding: '12px 16px 28px' }}>
        <button onClick={submit} disabled={!nome.trim()} style={{
          width: '100%', background: !nome.trim() ? '#eceef2' : theme.primary, color: !nome.trim() ? '#9a9a9a' : '#fff',
          border: `1.5px solid ${!nome.trim() ? theme.border : 'transparent'}`,
          padding: '15px', borderRadius: 50, fontSize: 15, fontWeight: 600,
          cursor: !nome.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>Adicionar cliente</button>
      </div>
    </div>
  );
}

function PAtividade({ theme }) {
  const { recent, clientes } = useStore();
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: theme.primary, padding: '56px 20px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Extrato</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{recent.length} movimentações</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 80px' }}>
        <div style={{ background: theme.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${theme.divider}` }}>
          {recent.map((a, i) => {
            const c = clientes.find(x => x.id === a.clienteId) || { nome: 'Cliente' };
            return (
              <div key={a.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: a.tipo === 'pagamento' ? '#d1fae5' : theme.primaryLight, color: a.tipo === 'pagamento' ? theme.success : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FPIcon name={a.tipo === 'pagamento' ? 'arrow-down' : 'plus'} size={14} stroke={2}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 1 }}>{a.descricao} · {formatRelative(a.quando)}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: a.tipo === 'pagamento' ? theme.success : theme.text, fontVariantNumeric: 'tabular-nums' }}>
                    {a.tipo === 'pagamento' ? '+' : ''}{brl(a.valor)}
                  </div>
                </div>
                {i < recent.length - 1 && <div style={{ height: 1, background: theme.divider, marginLeft: 60 }}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PPerfil({ theme }) {
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: theme.primary, padding: '56px 20px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Menu</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px 80px' }}>
        {/* Profile card */}
        <div style={{ background: theme.surface, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginTop: -4, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${theme.divider}` }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: theme.primaryLight, border: `1.5px solid ${theme.primary}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: theme.primary }}>CM</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Cristiane Matos</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 1 }}>Mercearia da Cris · Recife</div>
          </div>
        </div>

        {/* Menu items */}
        {[
          { icon: 'users', label: 'Clientes' },
          { icon: 'chart', label: 'Relatórios' },
          { icon: 'bell', label: 'Notificações' },
          { icon: 'settings', label: 'Configurações' },
        ].map((item, i, a) => (
          <div key={item.label} style={{ background: theme.surface, borderRadius: i === 0 ? '14px 14px 0 0' : i === a.length - 1 ? '0 0 14px 14px' : 0, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, marginTop: i === 0 ? 10 : 0, border: `1px solid ${theme.divider}`, borderTop: i === 0 ? undefined : 'none', cursor: 'pointer' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: theme.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FPIcon name={item.icon} size={16} color={theme.primary} stroke={1.8}/>
            </div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: theme.text }}>{item.label}</span>
            <FPIcon name="chevron-right" size={14} color={theme.textSubtle} stroke={1.5}/>
          </div>
        ))}

        {/* Upgrade banner */}
        <div style={{ background: theme.primary, borderRadius: 16, padding: 18, marginTop: 14, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.7 }}>Fiado Pro</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, lineHeight: 1.35 }}>Score automático e cobranças via WhatsApp</div>
          <button style={{ marginTop: 12, background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: '#fff', padding: '10px 18px', borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Experimentar grátis</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PDetalhe, PNovoFiado, PPagamento, PNovoCliente, PAtividade, PPerfil });
