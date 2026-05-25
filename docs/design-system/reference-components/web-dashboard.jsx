// Web/desktop dashboard variants.

function WSparkline({ data, color, height = 48, width = 160 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const fillD = d + ` L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`spg-${color.replace(/[^a-z0-9]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#spg-${color.replace(/[^a-z0-9]/gi,'')})`}/>
      <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function WBarChart({ data, color, height = 140 }) {
  const max = Math.max(...data.map(d => d.valor));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height, padding: '8px 4px 0' }}>
      {data.map((d, i) => {
        const h = (d.valor / max) * (height - 30);
        const isLast = i === data.length - 1;
        return (
          <div key={d.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isLast ? color : 'var(--fp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{d.valor.toFixed(1)}k</div>
            <div style={{ width: '100%', height: h, background: isLast ? color : 'var(--fp-border)', borderRadius: 6, transition: 'all .3s', opacity: isLast ? 1 : 0.6 }}/>
            <div style={{ fontSize: 11, color: 'var(--fp-text-muted)', fontWeight: isLast ? 700 : 500 }}>{d.mes}</div>
          </div>
        );
      })}
    </div>
  );
}

// Sidebar — shared
function WSidebar({ theme, active = 'Início' }) {
  const items = [
    { icon: 'home', label: 'Início' },
    { icon: 'users', label: 'Clientes', count: 47 },
    { icon: 'list', label: 'Lançamentos' },
    { icon: 'chart', label: 'Relatórios' },
    { icon: 'bell', label: 'Notificações', count: 3 },
    { icon: 'settings', label: 'Configurações' },
  ];
  return (
    <aside style={{ width: 240, background: theme.surface, borderRight: `1px solid ${theme.border}`, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 18, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 3h14v4H11v5h7v4h-7v7H5V3z" fill="#fff"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, letterSpacing: -0.3 }}>Fiado<span style={{ color: theme.accent }}>Pro</span></div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: -2 }}>Smart credit tracker</div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => {
          const isActive = it.label === active;
          return (
            <div key={it.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
              background: isActive ? theme.primaryLight : 'transparent',
              color: isActive ? theme.primary : theme.text,
              fontWeight: isActive ? 600 : 500, fontSize: 14, cursor: 'pointer',
            }}>
              <FPIcon name={it.icon} size={18} stroke={isActive ? 2.2 : 1.8}/>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.count && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: isActive ? theme.primary : theme.border, color: isActive ? '#fff' : theme.textMuted }}>{it.count}</span>}
            </div>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ background: `linear-gradient(135deg, ${theme.accent} 0%, #D97706 100%)`, borderRadius: 16, padding: 14, color: '#78350F' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            <FPIcon name="sparkle" size={14}/> Fiado Pro
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: '#451A03', lineHeight: 1.35 }}>Score de crédito automático + cobrança via WhatsApp</div>
          <button style={{ marginTop: 10, width: '100%', background: '#1F1917', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Experimentar grátis</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '8px 4px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 17, background: theme.primaryLight, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>CM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Cristiane M.</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Mercearia da Cris</div>
          </div>
          <FPIcon name="chevron-down" size={14} color={theme.textMuted}/>
        </div>
      </div>
    </aside>
  );
}

// ─── Web Variant A — clean analytics dashboard ─────────────────
function WebDashboardA({ theme }) {
  const d = fiadoData;
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <WSidebar theme={theme} active="Início"/>

      <main style={{ flex: 1, overflow: 'auto', background: theme.bg }}>
        {/* Top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: theme.mode === 'dark' ? 'rgba(11,15,26,0.85)' : 'rgba(248,250,252,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${theme.border}`, padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Terça, 22 de abril</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, letterSpacing: -0.3 }}>Visão geral</div>
          </div>
          <div style={{ flex: 1 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: 280, color: theme.textMuted }}>
            <FPIcon name="search" size={16}/>
            <span style={{ fontSize: 13 }}>Buscar cliente, lançamento…</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 6px', borderRadius: 4, background: theme.bg, color: theme.textSubtle, fontFamily: 'ui-monospace, monospace' }}>⌘K</span>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.surface, border: `1px solid ${theme.border}`, padding: '8px 14px', borderRadius: 12, color: theme.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <FPIcon name="calendar" size={15}/> Abril 2026
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.primary, color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <FPIcon name="plus" size={15}/> Novo lançamento
          </button>
        </div>

        <div style={{ padding: '24px 28px 40px' }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { k: 'A receber',     v: brl(d.kpis.aReceber),    t: `+${d.kpis.aReceberTrend}%`, tc: theme.success, icon: 'wallet', iconBg: theme.primaryLight, iconFg: theme.primary, spark: d.sparkline, sparkColor: theme.primary },
              { k: 'Recebido em abril', v: brl(d.kpis.recebidoMes), t: `+${d.kpis.recebidoTrend}%`, tc: theme.success, icon: 'trending-up', iconBg: theme.mode === 'dark' ? 'rgba(16,185,129,0.15)' : '#D1FAE5', iconFg: theme.success, spark: [3.2,3.5,4.0,4.5,4.8,5.3,5.9,6.21], sparkColor: theme.success },
              { k: 'Em atraso',     v: brl(d.kpis.atrasado),    t: `${d.kpis.atrasadoTrend}%`,  tc: theme.success, icon: 'alert', iconBg: theme.mode === 'dark' ? 'rgba(239,68,68,0.15)' : '#FEE2E2', iconFg: theme.error, spark: [1.2,1.4,1.3,1.1,1.0,1.05,0.95,0.94], sparkColor: theme.error },
              { k: 'Clientes ativos', v: String(d.kpis.clientesAtivos), t: `+${d.kpis.clientesNovos} novos`, tc: theme.success, icon: 'users', iconBg: theme.mode === 'dark' ? 'rgba(245,158,11,0.15)' : '#FEF3C7', iconFg: '#B45309', spark: [40,41,42,43,44,45,46,47], sparkColor: theme.accent },
            ].map(k => (
              <div key={k.k} style={{ background: theme.surface, borderRadius: 24, padding: 18, border: `1px solid ${theme.border}`, boxShadow: theme.mode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: k.iconBg, color: k.iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FPIcon name={k.icon} size={18}/>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: k.tc, background: theme.mode === 'dark' ? 'rgba(16,185,129,0.12)' : '#D1FAE5', padding: '3px 8px', borderRadius: 8 }}>{k.t}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 14 }}>{k.k}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: theme.text, marginTop: 4, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
                <div style={{ marginTop: 8, marginLeft: -4 }}>
                  <WSparkline data={k.spark} color={k.sparkColor} width={200} height={36}/>
                </div>
              </div>
            ))}
          </div>

          {/* Chart + distribution row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ background: theme.surface, borderRadius: 24, padding: 20, border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Recebimentos por mês</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Últimos 6 meses · em R$ mil</div>
                </div>
                <div style={{ display: 'flex', gap: 4, padding: 3, background: theme.bg, borderRadius: 10 }}>
                  {['6M', '12M', 'Tudo'].map((o, i) => (
                    <button key={o} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', background: i === 0 ? theme.surface : 'transparent', color: i === 0 ? theme.text : theme.textMuted, cursor: 'pointer', boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', fontFamily: 'inherit' }}>{o}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <WBarChart data={d.mensal} color={theme.primary} height={180}/>
              </div>
            </div>

            <div style={{ background: theme.surface, borderRadius: 24, padding: 20, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Status da carteira</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>47 clientes ativos</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 20 }}>
                <MDonut segments={[
                  { pct: 62, color: theme.success },
                  { pct: 23, color: theme.warning },
                  { pct: 15, color: theme.error },
                ]} size={120} thickness={14}/>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {d.distribuicao.map(s => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: theme[s.cor] }}/>
                        <span style={{ fontSize: 12, color: theme.textMuted, flex: 1 }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
                      </div>
                      <div style={{ height: 4, background: theme.border, borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ width: s.pct + '%', height: '100%', background: theme[s.cor], borderRadius: 2 }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Devedores table + activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ background: theme.surface, borderRadius: 24, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: `1px solid ${theme.border}` }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Maiores saldos</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Ordenado por valor · clique para detalhes</div>
                </div>
                <button style={{ background: 'transparent', border: `1px solid ${theme.border}`, color: theme.text, padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <FPIcon name="filter" size={13}/> Filtrar
                </button>
              </div>
              <div>
                {[...d.clientes].sort((a,b) => b.saldo - a.saldo).slice(0, 6).map((c, i, arr) => {
                  const sc = scoreColors(c.score, theme.mode);
                  const overdue = c.status.startsWith('atrasado');
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1.8fr 1fr 1fr 20px', gap: 14, alignItems: 'center', padding: '12px 20px', borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 18, background: theme.primaryLight, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{c.inic}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{c.tel} · últ. {c.ultima}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: sc.bg, color: sc.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>● {c.score}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: overdue ? theme.error : theme.text, fontVariantNumeric: 'tabular-nums' }}>{brl(c.saldo)}</div>
                        <div style={{ fontSize: 10, color: overdue ? theme.error : theme.textMuted, marginTop: 1, fontWeight: 500 }}>{c.status}</div>
                      </div>
                      <FPIcon name="chevron-right" size={16} color={theme.textMuted}/>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: theme.surface, borderRadius: 24, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Atividade recente</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Hoje · 6 eventos</div>
              </div>
              <div style={{ padding: '8px 0' }}>
                {d.atividade.slice(0, 6).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 15, background: a.tipo === 'pagamento' ? (theme.mode === 'dark' ? 'rgba(16,185,129,0.16)' : '#D1FAE5') : theme.primaryLight, color: a.tipo === 'pagamento' ? theme.success : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FPIcon name={a.tipo === 'pagamento' ? 'arrow-down' : 'plus'} size={13}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: theme.text }}><strong style={{ fontWeight: 600 }}>{a.quem}</strong> · {a.tipo === 'pagamento' ? 'pagou' : 'fiou'}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{a.quando}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: a.tipo === 'pagamento' ? theme.success : theme.text, fontVariantNumeric: 'tabular-nums' }}>
                      {a.tipo === 'pagamento' ? '+' : ''}{brl(a.valor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Web Variant B — editorial, bold & typographic ─────────────
function WebDashboardB({ theme }) {
  const d = fiadoData;
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
      <WSidebar theme={theme} active="Início"/>
      <main style={{ flex: 1, overflow: 'auto', background: theme.bg, padding: '28px 36px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: theme.primary, textTransform: 'uppercase' }}>Painel · abril 2026</div>
            <h1 style={{ fontSize: 42, fontWeight: 700, color: theme.text, margin: '8px 0 0', letterSpacing: -1.5, lineHeight: 1.05 }}>Boa tarde, Cristiane.</h1>
            <div style={{ fontSize: 15, color: theme.textMuted, marginTop: 10, maxWidth: 480, lineHeight: 1.5 }}>Sua carteira está saudável. <strong style={{ color: theme.text, fontWeight: 600 }}>62%</strong> dos clientes estão em dia e os atrasos caíram 4,1% na semana.</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, padding: '10px 14px', borderRadius: 14, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <FPIcon name="download" size={15}/> Exportar
            </button>
            <button style={{ background: theme.text, color: theme.bg, border: 'none', padding: '10px 18px', borderRadius: 14, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
              <FPIcon name="plus" size={15}/> Novo lançamento
            </button>
          </div>
        </div>

        {/* Hero split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
          <div style={{ background: `linear-gradient(145deg, ${theme.primaryDark} 0%, ${theme.primary} 70%)`, borderRadius: 28, padding: 28, color: '#fff', position: 'relative', overflow: 'hidden', minHeight: 260 }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 360, height: 360, borderRadius: 180, background: 'rgba(255,255,255,0.06)' }}/>
            <div style={{ position: 'absolute', bottom: -140, right: 60, width: 260, height: 260, borderRadius: 130, background: 'rgba(255,255,255,0.05)' }}/>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.75 }}>Total a receber</div>
              <div style={{ fontSize: 64, fontWeight: 700, marginTop: 8, letterSpacing: -2.2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{brl(d.kpis.aReceber)}</div>
              <div style={{ display: 'flex', gap: 18, marginTop: 22 }}>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Evolução · 14d</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>+12,4%</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }}/>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Ticket médio</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>R$ 81,86</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }}/>
                <div>
                  <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>A vencer · 7d</div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>R$ 1,2k</div>
                </div>
              </div>
              <div style={{ marginTop: 18, marginLeft: -8 }}>
                <WSparkline data={d.sparkline} color="#ffffff" width={420} height={54}/>
              </div>
            </div>
          </div>

          <div style={{ background: theme.accent, borderRadius: 28, padding: 24, color: '#451A03', position: 'relative', overflow: 'hidden', minHeight: 260, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              <FPIcon name="zap" size={13}/> Ação recomendada
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 14, letterSpacing: -0.8, lineHeight: 1.15 }}>3 clientes vencem hoje — cobre em um clique.</div>
            <div style={{ display: 'flex', marginTop: 18, gap: -8 }}>
              {['SA', 'PR', 'EN'].map((i, idx) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 18, background: '#1F1917', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, border: '2px solid #F59E0B', marginLeft: idx === 0 ? 0 : -10 }}>{i}</div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 600, alignSelf: 'center', marginLeft: 10 }}>R$ 1.262,40 no total</div>
            </div>
            <div style={{ flex: 1 }}/>
            <button style={{ background: '#1F1917', color: '#F59E0B', border: 'none', padding: '12px 18px', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
              <FPIcon name="whatsapp" size={16}/> Enviar cobrança via WhatsApp
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 18, background: theme.surface, borderRadius: 20, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          {[
            { k: 'Recebido em abril', v: brl(d.kpis.recebidoMes), t: '+8,2%' },
            { k: 'Em atraso',     v: brl(d.kpis.atrasado),    t: '-4,1%' },
            { k: 'Clientes ativos', v: '47',                   t: '+3 novos' },
            { k: 'Score médio',   v: '728',                   t: 'bom' },
          ].map((s, i, a) => (
            <div key={s.k} style={{ padding: '18px 20px', borderRight: i < a.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.k}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: theme.text, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                <div style={{ fontSize: 12, color: theme.success, fontWeight: 600 }}>{s.t}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Devedores */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: -0.6 }}>Carteira</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Todos', 'Em dia', 'A vencer', 'Atrasados'].map((t, i) => (
                <button key={t} style={{
                  padding: '6px 14px', borderRadius: 999, border: `1px solid ${i === 0 ? theme.text : theme.border}`,
                  background: i === 0 ? theme.text : 'transparent',
                  color: i === 0 ? theme.bg : theme.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 16 }}>
            {d.clientes.slice(0, 6).map((c, i) => {
              const sc = scoreColors(c.score, theme.mode);
              const overdue = c.status.startsWith('atrasado');
              const toBe = c.status.startsWith('vence');
              return (
                <div key={i} style={{ background: theme.surface, borderRadius: 20, padding: 18, border: `1px solid ${theme.border}`, position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 21, background: theme.primaryLight, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{c.inic}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{c.nome}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{c.tel}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: sc.bg, color: sc.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.score}</span>
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Saldo</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: overdue ? theme.error : theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>{brl(c.saldo)}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: overdue ? theme.error : toBe ? theme.warning : theme.success, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FPIcon name={overdue ? 'alert' : toBe ? 'clock' : 'check'} size={13}/> {c.status}
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
                    <button style={{ flex: 1, background: theme.primary, color: '#fff', border: 'none', padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}>
                      <FPIcon name="send" size={13}/> Cobrar
                    </button>
                    <button style={{ background: 'transparent', color: theme.text, border: `1px solid ${theme.border}`, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Detalhes</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { WebDashboardA, WebDashboardB });
