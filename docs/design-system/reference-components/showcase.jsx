// Design system showcase artboards — tokens, type, components.

function FPCard({ theme, children, style }) {
  return (
    <div style={{
      background: theme.surface, borderRadius: 16, padding: 20,
      border: `1px solid ${theme.border}`, ...style,
    }}>{children}</div>
  );
}

// Color swatch
function FPSwatch({ label, hex, theme, size = 72 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{
        width: '100%', height: size, borderRadius: 12, background: hex,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
      }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: -0.1 }}>{label}</div>
        <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', marginTop: 2 }}>{hex}</div>
      </div>
    </div>
  );
}

function ShowcaseColors({ theme }) {
  const primaries = [
    { k: 'Primary',     v: theme.primary },
    { k: 'Primary Dark',v: theme.primaryDark },
    { k: 'Primary Light',v: theme.primaryLight },
  ];
  const semantic = [
    { k: 'Success', v: theme.success },
    { k: 'Warning', v: theme.warning },
    { k: 'Error',   v: theme.error },
    { k: 'Accent',  v: theme.accent },
  ];
  const neutrals = [
    { k: 'Surface', v: theme.surface },
    { k: 'Border',  v: theme.border },
    { k: 'Text Muted', v: theme.textMuted },
    { k: 'Text',    v: theme.text },
  ];

  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', padding: 32, boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: theme.primary, marginBottom: 8 }}>TOKENS · COR</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: -0.6 }}>Paleta cromática</h1>
      <p style={{ fontSize: 14, color: theme.textMuted, marginTop: 8, marginBottom: 28, lineHeight: 1.5, maxWidth: 460 }}>
        Indigo estabilidade · Amber valor agregado · Slate densidade calma. Contraste mínimo AA em todos os pares.
      </p>

      <section style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Marca</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {primaries.map(p => <FPSwatch key={p.k} label={p.k} hex={p.v} theme={theme} />)}
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Semântica</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {semantic.map(p => <FPSwatch key={p.k} label={p.k} hex={p.v} theme={theme} />)}
        </div>
      </section>

      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Neutros</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {neutrals.map(p => <FPSwatch key={p.k} label={p.k} hex={p.v} theme={theme} size={64} />)}
        </div>
      </section>

      <div style={{ marginTop: 28, padding: 16, borderRadius: 12, background: theme.primaryLight, border: `1px solid ${theme.border}` }}>
        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Regra</div>
        <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.5 }}>
          Cores semânticas (verde/vermelho) <strong>só</strong> para status de pagamento ou score. Nunca use indigo para erro/sucesso.
        </div>
      </div>
    </div>
  );
}

function ShowcaseType({ theme }) {
  const scales = [
    { name: 'H1 · Display', size: 32, weight: 700, lh: 1.2, sample: 'Saldo a receber' },
    { name: 'H2 · Section', size: 24, weight: 700, lh: 1.3, sample: 'Clientes ativos' },
    { name: 'Body',         size: 16, weight: 400, lh: 1.5, sample: 'Dona Tereza realizou um pagamento.' },
    { name: 'Body Bold',    size: 16, weight: 700, lh: 1.5, sample: 'R$ 1.250,00' },
    { name: 'Caption',      size: 12, weight: 500, lh: 1.4, sample: 'ATUALIZADO HÁ 12 MIN' },
    { name: 'Overline',     size: 10, weight: 700, lh: 1.2, sample: 'SCORE · A VENCER', caps: true, tracking: 1.0 },
  ];
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', padding: 32, boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: theme.primary, marginBottom: 8 }}>TOKENS · TIPOGRAFIA</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: -0.6 }}>Inter · escala tipográfica</h1>
      <p style={{ fontSize: 14, color: theme.textMuted, marginTop: 8, marginBottom: 28, lineHeight: 1.5, maxWidth: 460 }}>
        Otimizada para densidade financeira. Nunca abaixo de 12px para valores monetários.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {scales.map(s => (
          <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, alignItems: 'baseline', paddingBottom: 16, borderBottom: `1px solid ${theme.border}` }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{s.name}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>{s.size}px · {s.weight}</div>
            </div>
            <div style={{
              fontSize: s.size, fontWeight: s.weight, lineHeight: s.lh,
              color: theme.text,
              textTransform: s.caps ? 'uppercase' : 'none',
              letterSpacing: s.tracking ? `${s.tracking}px` : -0.2,
            }}>{s.sample}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseFoundations({ theme }) {
  const spacing = [4, 8, 16, 24, 32, 48];
  const radii = [{ k: 'sm', v: 8 }, { k: 'md', v: 12 }, { k: 'lg', v: 16 }, { k: 'xl', v: 24 }, { k: 'full', v: 999 }];
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', padding: 32, boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: theme.primary, marginBottom: 8 }}>TOKENS · FUNDAMENTOS</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: -0.6 }}>Espaço · forma · elevação</h1>

      <section style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Espaçamento · base 8px</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {spacing.map(s => (
            <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: s, height: s, background: theme.primary, borderRadius: 2 }} />
              <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'ui-monospace, monospace' }}>{s}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Border-radius</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {radii.map(r => (
            <div key={r.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 64, height: 64, background: theme.primaryLight, borderRadius: r.v, border: `1px solid ${theme.border}` }} />
              <div style={{ fontSize: 11, color: theme.text, fontWeight: 600 }}>{r.k}</div>
              <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: 'ui-monospace, monospace', marginTop: -4 }}>{r.v === 999 ? '∞' : r.v + 'px'}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Elevação</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { k: 'Low',  v: '0 1px 3px 0 rgb(0 0 0 / 0.1)' },
            { k: 'Med',  v: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)' },
            { k: 'High', v: '0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.08)' },
          ].map(s => (
            <div key={s.k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 90, height: 64, background: theme.surface, borderRadius: 12, boxShadow: s.v, border: `1px solid ${theme.border}` }} />
              <div style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>{s.k}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Component showcase — buttons, inputs, badges, cards
function ShowcaseComponents({ theme }) {
  return (
    <div style={{ ...fiadoThemeStyle(theme), width: '100%', height: '100%', padding: 32, boxSizing: 'border-box', overflow: 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: theme.primary, marginBottom: 8 }}>COMPONENTES</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: -0.6 }}>Átomos & moléculas</h1>

      <section style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Botões</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{ background: theme.primary, color: '#fff', border: `1.5px solid transparent`, padding: '12px 20px', borderRadius: 50, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Receber pagamento</button>
          <button style={{ background: theme.surface, color: theme.primary, border: `1.5px solid ${theme.primary}`, padding: '12px 20px', borderRadius: 50, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Secundário</button>
          <button style={{ background: 'transparent', color: theme.primary, border: 'none', padding: '12px 20px', borderRadius: 50, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Ghost</button>
          <button style={{ background: theme.accent, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 50, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Upgrade Pro</button>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Input</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Nome do cliente</div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${theme.primary}`, background: theme.surface, fontSize: 15, color: theme.text, boxShadow: `0 0 0 4px ${theme.primaryLight}` }}>Juliana Barbosa|</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Valor</div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${theme.error}`, background: theme.surface, fontSize: 15, color: theme.text }}>R$ –</div>
            <div style={{ fontSize: 12, color: theme.error, marginTop: 6 }}>Informe um valor válido</div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Badges · score</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['alto', 'médio', 'baixo'].map(s => {
            const c = scoreColors(s, theme.mode);
            return (
              <span key={s} style={{ background: c.bg, color: c.fg, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>score {s}</span>
            );
          })}
          <span style={{ background: theme.primaryLight, color: theme.primary, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Em dia</span>
          <span style={{ background: theme.mode === 'dark' ? 'rgba(239,68,68,0.18)' : '#FEE2E2', color: theme.error, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Atrasado 8d</span>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Organismo · card de devedor</div>
        <div style={{ background: theme.surface, borderRadius: 20, padding: 16, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 14, boxShadow: theme.mode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: theme.primaryLight, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>JB</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Juliana Barbosa</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>(81) 9 9234-1120 · atualizado ontem</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.error, fontVariantNumeric: 'tabular-nums' }}>R$ 412,80</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: scoreColors('alto', theme.mode).fg, marginTop: 2 }}>● SCORE ALTO</div>
          </div>
          <FPIcon name="chevron-right" size={18} color={theme.textMuted} />
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { ShowcaseColors, ShowcaseType, ShowcaseFoundations, ShowcaseComponents });
