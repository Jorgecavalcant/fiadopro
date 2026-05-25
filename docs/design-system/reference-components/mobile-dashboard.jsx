// Mobile dashboard variants — rendered inside IOSDevice frames.

// Reusable pieces ───────────────────────────────────────────────
function MSparkline({ data, color, height = 40, width = 120, fill = true }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const fillD = d + ` L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {fill && <path d={fillD} fill={color} opacity="0.15"/>}
      <path d={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3" fill={color}/>
    </svg>
  );
}

function MDonut({ segments, size = 92, thickness = 11 }) {
  // segments: [{pct, color}]
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={thickness}/>
      {segments.map((s, i) => {
        const len = (s.pct / 100) * c;
        const offset = c - acc;
        acc += len;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"/>
        );
      })}
    </svg>
  );
}

// ─── Variant A · calm & spec-faithful ──────────────────────────
function MobileDashboardA({ theme }) {
  const d = fiadoData;
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Custom header */}
      <div style={{ paddingTop: 56, padding: '56px 20px 14px', background: theme.bg, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: theme.primaryLight, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>CM</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>Olá, Cristiane</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.lojista.estabelecimento}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <FPIcon name="bell" size={18} color={theme.textMuted}/>
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, background: theme.error, border: `2px solid ${theme.bg}` }}/>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 100px' }}>
        {/* Hero card */}
        <div style={{ background: theme.primary, borderRadius: 24, padding: 20, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, background: 'rgba(255,255,255,0.08)' }}/>
          <div style={{ position: 'absolute', top: 40, right: -60, width: 120, height: 120, borderRadius: 60, background: 'rgba(255,255,255,0.06)' }}/>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 }}>Saldo a receber</div>
            <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>{brl(d.kpis.aReceber)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13 }}>
              <FPIcon name="trending-up" size={14} color="#fff"/>
              <span style={{ opacity: 0.95 }}>+{d.kpis.aReceberTrend}% essa semana</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button style={{ flex: 1, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', padding: '11px 14px', borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FPIcon name="plus" size={16}/> Lançar
              </button>
              <button style={{ flex: 1, background: '#fff', color: theme.primary, border: 'none', padding: '11px 14px', borderRadius: 14, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FPIcon name="send" size={15}/> Cobrar
              </button>
            </div>
          </div>
        </div>

        {/* Metric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <div style={{ background: theme.surface, borderRadius: 16, padding: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recebido · Abr</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{brlShort(d.kpis.recebidoMes)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: theme.success, marginTop: 2, fontWeight: 600 }}>
              <FPIcon name="arrow-up" size={11}/> +{d.kpis.recebidoTrend}%
            </div>
          </div>
          <div style={{ background: theme.surface, borderRadius: 16, padding: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Atrasados</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: theme.error, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{brlShort(d.kpis.atrasado)}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>3 clientes</div>
          </div>
        </div>

        {/* Distribution */}
        <div style={{ background: theme.surface, borderRadius: 20, padding: 16, marginTop: 14, border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>Distribuição da carteira</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>47 clientes</div>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: '62%', background: theme.success }}/>
            <div style={{ width: '23%', background: theme.warning }}/>
            <div style={{ width: '15%', background: theme.error }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            {d.distribuicao.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: theme[s.cor] }}/>
                <span style={{ color: theme.textMuted }}>{s.label}</span>
                <span style={{ color: theme.text, fontWeight: 700 }}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 0 10px', padding: '0 2px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>Atividade</div>
          <div style={{ fontSize: 12, color: theme.primary, fontWeight: 600 }}>Ver tudo</div>
        </div>
        <div style={{ background: theme.surface, borderRadius: 20, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          {d.atividade.slice(0, 4).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < 3 ? `1px solid ${theme.border}` : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 17, background: a.tipo === 'pagamento' ? (theme.mode === 'dark' ? 'rgba(16,185,129,0.16)' : '#D1FAE5') : theme.primaryLight, color: a.tipo === 'pagamento' ? theme.success : theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FPIcon name={a.tipo === 'pagamento' ? 'arrow-down' : 'plus'} size={15}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.quem}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{a.tipo === 'pagamento' ? 'Pagamento recebido' : 'Novo lançamento'} · {a.quando}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: a.tipo === 'pagamento' ? theme.success : theme.text, fontVariantNumeric: 'tabular-nums' }}>
                {a.tipo === 'pagamento' ? '+' : ''}{brl(a.valor)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom tab bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: theme.surface, borderTop: `1px solid ${theme.border}`, paddingBottom: 28, paddingTop: 8, display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: 'home', label: 'Início', active: true },
          { icon: 'users', label: 'Clientes' },
          { icon: 'chart', label: 'Relatórios' },
          { icon: 'user', label: 'Perfil' },
        ].map(t => (
          <div key={t.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: t.active ? theme.primary : theme.textMuted }}>
            <FPIcon name={t.icon} size={22} stroke={t.active ? 2.2 : 1.8}/>
            <div style={{ fontSize: 10, fontWeight: t.active ? 700 : 500 }}>{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Variant B · bold, glassy, donut-centric ───────────────────
function MobileDashboardB({ theme }) {
  const d = fiadoData;
  const gradient = `linear-gradient(160deg, ${theme.primaryDark} 0%, ${theme.primary} 100%)`;
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', background: theme.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* gradient dome */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320, background: gradient, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}/>
      <div style={{ position: 'absolute', top: 40, right: -80, width: 280, height: 280, borderRadius: 140, background: 'rgba(255,255,255,0.08)' }}/>

      <div style={{ position: 'relative', paddingTop: 56, padding: '56px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>CM</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 500 }}>Bom dia, Cristiane</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{d.lojista.estabelecimento}</div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FPIcon name="bell" size={17} color="#fff"/>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 100px', position: 'relative' }}>
        {/* headline amount */}
        <div style={{ marginTop: 18, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>Total a receber</div>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 6, letterSpacing: -1.2, fontVariantNumeric: 'tabular-nums' }}>{brl(d.kpis.aReceber)}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 600 }}>
            <FPIcon name="trending-up" size={13}/> +{d.kpis.aReceberTrend}% na semana
          </div>
        </div>

        {/* donut glass card */}
        <div style={{ marginTop: 22, background: theme.mode === 'dark' ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 18, border: `1px solid ${theme.mode === 'dark' ? 'rgba(148,163,184,0.15)' : 'rgba(255,255,255,0.6)'}`, boxShadow: '0 20px 40px -10px rgba(15,23,42,0.25)', display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 92, height: 92 }}>
            <MDonut segments={[
              { pct: 62, color: theme.success },
              { pct: 23, color: theme.warning },
              { pct: 15, color: theme.error },
            ]} size={92}/>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, lineHeight: 1 }}>47</div>
              <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>clientes</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {d.distribuicao.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: 4, background: theme[s.cor] }}/>
                <div style={{ flex: 1, fontSize: 12, color: theme.textMuted }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
          {[
            { icon: 'plus', label: 'Fiado', primary: true },
            { icon: 'send', label: 'Cobrar' },
            { icon: 'users', label: 'Clientes' },
            { icon: 'chart', label: 'Relatório' },
          ].map(a => (
            <div key={a.label} style={{ background: a.primary ? theme.primary : theme.surface, borderRadius: 16, padding: '14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: a.primary ? 'none' : `1px solid ${theme.border}`, color: a.primary ? '#fff' : theme.text }}>
              <FPIcon name={a.icon} size={20} color={a.primary ? '#fff' : theme.primary}/>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</div>
            </div>
          ))}
        </div>

        {/* top devedores */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 2px 10px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Atenção hoje</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>3 pendentes</div>
        </div>
        {d.clientes.filter(c => c.status.startsWith('vence') || c.status.startsWith('atrasado')).slice(0, 3).map((c, i) => {
          const overdue = c.status.startsWith('atrasado');
          return (
            <div key={i} style={{ background: theme.surface, borderRadius: 18, padding: 12, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: theme.primaryLight, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{c.inic}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{c.nome}</div>
                <div style={{ fontSize: 11, color: overdue ? theme.error : theme.warning, fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FPIcon name={overdue ? 'alert' : 'clock'} size={11}/> {c.status}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: overdue ? theme.error : theme.text, fontVariantNumeric: 'tabular-nums' }}>{brl(c.saldo)}</div>
                <div style={{ fontSize: 10, color: theme.primary, fontWeight: 700, marginTop: 2 }}>COBRAR →</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB */}
      <div style={{ position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, background: theme.accent, boxShadow: '0 12px 28px -6px rgba(245,158,11,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78350F' }}>
        <FPIcon name="plus" size={24} stroke={2.4}/>
      </div>

      {/* Tab bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: theme.surface, borderTop: `1px solid ${theme.border}`, paddingBottom: 28, paddingTop: 8, display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: 'home', label: 'Início', active: true },
          { icon: 'users', label: 'Clientes' },
          { icon: 'chart', label: 'Análise' },
          { icon: 'user', label: 'Perfil' },
        ].map(t => (
          <div key={t.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: t.active ? theme.primary : theme.textMuted }}>
            <FPIcon name={t.icon} size={22} stroke={t.active ? 2.2 : 1.8}/>
            <div style={{ fontSize: 10, fontWeight: t.active ? 700 : 500 }}>{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MobileDashboardA, MobileDashboardB, MSparkline, MDonut });
