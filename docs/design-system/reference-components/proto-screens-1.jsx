// Mobile prototype screens — visual identity v2.
// Navy header band · pill buttons · square avatars · card-over-band pattern.

// ─── Header band + card overlap pattern ───────────────────────
function PHeader({ theme, title, onBack, onRight, rightIcon, subtitle, hero }) {
  const isDark = hero;
  return (
    <div style={{
      paddingTop: 56, padding: '56px 20px 14px', display: 'flex', alignItems: 'center', gap: 12,
      background: isDark ? theme.primary : theme.bg, position: 'relative', zIndex: 5,
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 18, background: isDark ? 'rgba(255,255,255,0.15)' : theme.surface,
          border: isDark ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
        }}>
          <FPIcon name="chevron-left" size={20} color={isDark ? '#fff' : theme.primary} stroke={2}/>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? '#fff' : theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.55)' : theme.textSubtle, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {onRight && (
        <button onClick={onRight} style={{
          width: 36, height: 36, borderRadius: 18, background: isDark ? 'rgba(255,255,255,0.15)' : theme.surface,
          border: isDark ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
        }}>
          <FPIcon name={rightIcon || 'plus'} size={18} color={isDark ? '#fff' : theme.primary} stroke={1.8}/>
        </button>
      )}
    </div>
  );
}

// ─── Tab bar — matches login flow BottomNav ────────────────────
function PTabBar({ theme, active, onChange }) {
  const tabs = [
    { key: 'home',      Icon: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3L21 9.5V20C21 20.6 20.6 21 20 21H15V16H9V21H4C3.4 21 3 20.6 3 20V9.5Z"/></svg>, label: 'Início' },
    { key: 'clientes',  Icon: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="12" y2="17"/></svg>, label: 'Clientes' },
    { key: 'atividade', Icon: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>, label: 'Extrato' },
    { key: 'perfil',    Icon: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>, label: 'Menu' },
  ];
  const isDark = theme.mode === 'dark';
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: theme.surface, borderTop: `1px solid ${theme.divider}`,
      height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 2, zIndex: 40,
    }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', padding: '6px 12px',
            color: isActive ? theme.primary : theme.textSubtle, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <t.Icon/>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── FAB ──────────────────────────────────────────────────────
function PFab({ theme, onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', bottom: 76, right: 20,
      width: 52, height: 52, borderRadius: 26,
      background: theme.primary, color: '#fff', border: 'none',
      cursor: 'pointer', padding: 0,
      boxShadow: '0 6px 20px rgba(26,63,111,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 45,
    }}>
      <FPIcon name="plus" size={22} stroke={2.5} color="#fff"/>
    </button>
  );
}

// ─── Home screen ──────────────────────────────────────────────
function PHome({ theme, navigate }) {
  const { kpis, clientes, statusCliente, saldoDoCliente, recent, cobrar } = useStore();

  const atencao = clientes
    .map(c => ({ ...c, saldo: saldoDoCliente(c.id), status: statusCliente(c.id) }))
    .filter(c => c.saldo > 0 && (c.status.tone === 'error' || c.status.tone === 'warning'))
    .sort((a, b) => a.status.tone === 'error' && b.status.tone !== 'error' ? -1 : 1)
    .slice(0, 3);

  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* Navy header band */}
      <div style={{ background: theme.primary, padding: '0 20px 32px', paddingTop: 56 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Cristiane Matos</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 1 }}>Mercearia da Cris</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, padding: 4 }}>
              <FPIcon name="bell" size={20} color="rgba(255,255,255,0.8)" stroke={1.8}/>
            </button>
            <div style={{ width: 34, height: 34, borderRadius: 50, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FPIcon name="user" size={18} color="rgba(255,255,255,0.8)" stroke={1.8}/>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Total a receber</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{brl(kpis.aReceber)}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{kpis.clientesAtivos} clientes com saldo em aberto</div>
        </div>
      </div>

      {/* Floating quick-action card */}
      <div style={{ background: theme.surface, margin: '0 16px', borderRadius: 16, padding: '14px 14px', marginTop: -16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', display: 'flex', gap: 10, position: 'relative', zIndex: 2 }}>
        <button onClick={() => navigate({ screen: 'novoFiado' })} style={{
          flex: 1, padding: '12px 10px', borderRadius: 12,
          border: `1.5px solid ${theme.primary}`, background: theme.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'inherit', fontWeight: 600, fontSize: 13, color: '#fff', cursor: 'pointer',
        }}>
          <FPIcon name="plus" size={16} color="#fff" stroke={2.5}/> Novo Fiado
        </button>
        <button onClick={() => navigate({ screen: 'clientes' })} style={{
          flex: 1, padding: '12px 10px', borderRadius: 12,
          border: `1.5px solid ${theme.border}`, background: theme.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'inherit', fontWeight: 600, fontSize: 13, color: theme.primary, cursor: 'pointer',
        }}>
          <FPIcon name="msg" size={16} color={theme.primary} stroke={1.8}/> Cobrar
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 80px' }}>
        {/* KPI mini strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', border: `1px solid ${theme.divider}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recebido · abr</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{brlShort(kpis.recebidoMes)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: theme.success, marginTop: 2, fontWeight: 600 }}>
              <FPIcon name="arrow-up" size={11} color={theme.success}/> +8,2%
            </div>
          </div>
          <div style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', border: `1px solid ${theme.divider}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 10, color: theme.textSubtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Atrasados</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.error, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{brlShort(kpis.atrasado)}</div>
            <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 2 }}>3 clientes</div>
          </div>
        </div>

        {/* Atenção hoje */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>Clientes em aberto</span>
          <button onClick={() => navigate({ tab: 'clientes' })} style={{ background: 'none', border: 'none', fontSize: 12, color: theme.primary, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 2 }}>
            Ver todos <FPIcon name="chevron-right" size={14} color={theme.primary} stroke={2}/>
          </button>
        </div>

        <div style={{ background: theme.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${theme.divider}` }}>
          {atencao.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: theme.textSubtle, fontSize: 13 }}>Tudo em dia 🎉</div>
          ) : atencao.map((c, i) => {
            const overdue = c.status.tone === 'error';
            const COLORS = ['#c8783a', theme.primary, '#7a5c9e'];
            return (
              <div key={c.id}>
                <button onClick={() => navigate({ screen: 'detalhe', clienteId: c.id })} style={{
                  width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                  <FPAvatar inic={c.inic} size={36} theme={theme} color={COLORS[i % COLORS.length]}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: theme.textSubtle, marginTop: 1 }}>há {c.ultima}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{brl(c.saldo)}</div>
                  </div>
                  <FPIcon name="chevron-right" size={16} color={theme.textSubtle} stroke={1.5}/>
                </button>
                {i < atencao.length - 1 && <div style={{ height: 1, background: theme.divider, marginLeft: 64 }}/>}
              </div>
            );
          })}
        </div>

        {/* Recent activity */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 10px' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>Atividade recente</span>
          <button onClick={() => navigate({ tab: 'atividade' })} style={{ background: 'none', border: 'none', fontSize: 12, color: theme.primary, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 2 }}>
            Ver tudo <FPIcon name="chevron-right" size={14} color={theme.primary} stroke={2}/>
          </button>
        </div>
        <div style={{ background: theme.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${theme.divider}` }}>
          {recent.slice(0, 4).map((a, i, arr) => {
            const c = clientes.find(x => x.id === a.clienteId) || { nome: 'Cliente', inic: '?' };
            return (
              <div key={a.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: a.tipo === 'pagamento' ? '#d1fae5' : theme.primaryLight, color: a.tipo === 'pagamento' ? theme.success : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FPIcon name={a.tipo === 'pagamento' ? 'arrow-down' : 'plus'} size={14} stroke={2}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                    <div style={{ fontSize: 10, color: theme.textSubtle, marginTop: 1 }}>{a.tipo === 'pagamento' ? 'Pagamento' : 'Novo fiado'} · {formatRelative(a.quando)}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: a.tipo === 'pagamento' ? theme.success : theme.text, fontVariantNumeric: 'tabular-nums' }}>
                    {a.tipo === 'pagamento' ? '+' : ''}{brl(a.valor)}
                  </div>
                </div>
                {i < arr.length - 1 && <div style={{ height: 1, background: theme.divider, marginLeft: 60 }}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Clientes screen ──────────────────────────────────────────
function PClientes({ theme, navigate }) {
  const { clientes, saldoDoCliente, statusCliente } = useStore();
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('todos');

  const list = clientes
    .map(c => ({ ...c, saldo: saldoDoCliente(c.id), status: statusCliente(c.id) }))
    .filter(c => {
      if (q && !c.nome.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === 'atrasado' && c.status.tone !== 'error') return false;
      if (filter === 'em_dia' && c.saldo > 0) return false;
      if (filter === 'aberto' && c.saldo <= 0) return false;
      return true;
    })
    .sort((a, b) => b.saldo - a.saldo);

  const COLORS = ['#c8783a', theme.primary, '#7a5c9e', '#1a7a4a', '#c0392b', '#2558a0', '#5a3a8a', '#c87820'];

  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header band */}
      <div style={{ background: theme.primary, padding: '56px 20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Clientes</div>
          <button onClick={() => navigate({ screen: 'novoCliente' })} style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <FPIcon name="plus" size={18} color="#fff" stroke={2.5}/>
          </button>
        </div>
      </div>

      {/* Search card overlapping band */}
      <div style={{ background: theme.surface, margin: '0 16px', borderRadius: 16, padding: '14px 14px', marginTop: -16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme.bg, border: `1.5px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px' }}>
          <FPIcon name="search" size={16} color={theme.textSubtle} stroke={1.8}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente…"
            style={{ flex: 1, border: 'none', background: 'transparent', color: theme.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}/>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto' }}>
        {[
          { k: 'todos',    l: 'Todos' },
          { k: 'aberto',   l: 'Em aberto' },
          { k: 'atrasado', l: 'Atrasados' },
          { k: 'em_dia',   l: 'Quitados' },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: '6px 14px', borderRadius: 50,
            border: `1.5px solid ${filter === f.k ? theme.primary : theme.border}`,
            background: filter === f.k ? theme.primaryLight : theme.surface,
            color: filter === f.k ? theme.primary : theme.textMuted,
            fontSize: 12, fontWeight: filter === f.k ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>{f.l}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 80px' }}>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: theme.textSubtle, fontSize: 14 }}>Nenhum cliente encontrado</div>
        ) : (
          <div style={{ background: theme.surface, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${theme.divider}` }}>
            {list.map((c, i) => {
              const sc = scoreColors(c.score, theme.mode);
              return (
                <div key={c.id}>
                  <button onClick={() => navigate({ screen: 'detalhe', clienteId: c.id })} style={{
                    width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}>
                    <FPAvatar inic={c.inic} size={36} theme={theme} color={COLORS[i % COLORS.length]}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{c.nome}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: sc.bg, color: sc.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.score}</span>
                        <span style={{ fontSize: 11, color: c.status.tone === 'error' ? theme.error : c.status.tone === 'warning' ? theme.warning : theme.textSubtle }}>{c.status.label}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.saldo > 0 ? (c.status.tone === 'error' ? theme.error : theme.text) : theme.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                        {c.saldo > 0 ? brl(c.saldo) : '—'}
                      </div>
                      <div style={{ fontSize: 10, color: theme.textSubtle, marginTop: 1 }}>há {c.ultima}</div>
                    </div>
                    <FPIcon name="chevron-right" size={14} color={theme.textSubtle} stroke={1.5}/>
                  </button>
                  {i < list.length - 1 && <div style={{ height: 1, background: theme.divider, marginLeft: 64 }}/>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PHeader, PTabBar, PFab, PHome, PClientes });
