// Fiado Pro — design tokens v2, calibrated to match the Login Flow visual identity.
// Navy-first palette · pill buttons · warm gray background · card-over-band pattern.

const FIADO_TOKENS = {
  colors: {
    primary:   { base: '#1a3f6f', dark: '#0f2545', light: '#e6eef8' },
    secondary: { base: '#2558a0', light: '#e6eef8' },
    semantic:  { success: '#1a7a4a', error: '#c0392b', warning: '#c87820', info: '#2558a0' },
    neutral: {
      surface: '#ffffff',
      bg:      '#eceef2',
      border:  '#e2e0dd',
      divider: '#ececea',
      text:    '#1a1a1a',
      text_mid:'#5a5a5a',
      text_light:'#9a9a9a',
    },
  },
  type: { family: "'Inter', -apple-system, system-ui, sans-serif" },
  radius: { sm: 8, md: 12, lg: 16, btn: 50, full: 9999 },
  shadow: {
    card: '0 2px 16px rgba(0,0,0,0.08)',
    low:  '0 1px 4px rgba(0,0,0,0.06)',
    high: '0 8px 32px rgba(0,0,0,0.14)',
  },
};

// Alt primaries for Tweaks (each: base, dark, light)
const FIADO_PRIMARIES = {
  navy:     { base: '#1a3f6f', dark: '#0f2545', light: '#e6eef8' }, // default — matches Login Flow
  indigo:   { base: '#4338ca', dark: '#312E81', light: '#EEF2FF' },
  forest:   { base: '#1b5e38', dark: '#0d3320', light: '#d1fae5' },
  violet:   { base: '#6d28d9', dark: '#4c1d95', light: '#f3e8ff' },
  copper:   { base: '#7a3a1e', dark: '#4a2010', light: '#fef0e6' },
  graphite: { base: '#2d3748', dark: '#1a202c', light: '#f7fafc' },
};

// Build a full theme object from primaryName + mode.
function fiadoTheme(primaryName = 'navy', mode = 'light') {
  const p = FIADO_PRIMARIES[primaryName] || FIADO_PRIMARIES.navy;
  if (mode === 'dark') {
    return {
      primary: p.base,
      primaryDark: p.dark,
      primaryLight: p.light,
      primaryTint: 'rgba(255,255,255,0.06)',
      primaryMid: p.base,
      accent: '#c87820',
      accentLight: '#4a2e00',
      success: '#34d399',
      error: '#f87171',
      warning: '#fb923c',
      info: '#60a5fa',
      bg: '#0f172a',
      surface: '#1e293b',
      surfaceRaised: '#263347',
      border: '#2d3f55',
      borderStrong: '#3d526e',
      divider: '#243044',
      text: '#f1f5f9',
      textMid: '#94a3b8',
      textMuted: '#64748b',
      textSubtle: '#475569',
      mode,
      primaryName,
    };
  }
  return {
    primary: p.base,
    primaryDark: p.dark,
    primaryLight: p.light,
    primaryTint: p.light,
    primaryMid: '#2558a0',
    accent: '#c87820',
    accentLight: '#fef3c7',
    success: '#1a7a4a',
    error: '#c0392b',
    warning: '#c87820',
    info: '#2558a0',
    bg: '#eceef2',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    border: '#e2e0dd',
    borderStrong: '#c8c4be',
    divider: '#ececea',
    text: '#1a1a1a',
    textMid: '#5a5a5a',
    textMuted: '#5a5a5a',
    textSubtle: '#9a9a9a',
    mode,
    primaryName,
  };
}

function fiadoThemeStyle(theme) {
  return {
    '--fp-primary': theme.primary,
    '--fp-primary-dark': theme.primaryDark,
    '--fp-primary-light': theme.primaryLight,
    '--fp-accent': theme.accent,
    '--fp-success': theme.success,
    '--fp-error': theme.error,
    '--fp-warning': theme.warning,
    '--fp-bg': theme.bg,
    '--fp-surface': theme.surface,
    '--fp-border': theme.border,
    '--fp-text': theme.text,
    '--fp-text-muted': theme.textMuted,
    color: theme.text,
    background: theme.bg,
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
    WebkitFontSmoothing: 'antialiased',
  };
}

// ─── Shared UI atoms (used across prototype screens) ─────────────────────

// Pill button — primary filled
function FPBtnPrimary({ label, onClick, disabled, style, icon, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '14px 20px', borderRadius: 50,
      border: `1.5px solid ${disabled ? '#e2e0dd' : 'transparent'}`,
      background: disabled ? '#eceef2' : undefined,
      backgroundImage: disabled ? 'none' : undefined,
      backgroundColor: disabled ? '#eceef2' : undefined,
      color: disabled ? '#9a9a9a' : '#fff',
      fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, fontSize: 15,
      cursor: disabled ? 'default' : 'pointer',
      letterSpacing: 0.1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'opacity .15s', ...style,
    }}
    ref={el => { if (el && !disabled) el.style.background = undefined; }}
    >
      {icon}{label}{children}
    </button>
  );
}

// Outlined pill button
function FPBtnOutlined({ label, onClick, style, icon, color }) {
  const c = color || '#1a3f6f';
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px 20px', borderRadius: 50,
      border: `1.5px solid ${c}`,
      background: '#fff', color: c,
      fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, fontSize: 15,
      cursor: 'pointer', letterSpacing: 0.1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...style,
    }}>{icon}{label}</button>
  );
}

// Avatar — rounded square (matches login flow)
function FPAvatar({ inic, size = 36, theme, color }) {
  const bg = color ? color + '22' : theme.primaryLight;
  const fg = color || theme.primary;
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.28),
      background: bg, border: `1.5px solid ${fg}33`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color: fg,
      flexShrink: 0,
    }}>{inic}</div>
  );
}

// Card — white surface with shadow
function FPCard({ theme, children, style }) {
  return (
    <div style={{
      background: theme.surface, borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      border: `1px solid ${theme.divider}`,
      ...style,
    }}>{children}</div>
  );
}

// Score badge
const SCORE_STYLES = {
  alto:  { light: { bg: '#d1fae5', fg: '#1a7a4a' }, dark: { bg: 'rgba(52,211,153,0.15)', fg: '#34d399' } },
  médio: { light: { bg: '#fef3c7', fg: '#92400e' }, dark: { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' } },
  baixo: { light: { bg: '#fee2e2', fg: '#991b1b' }, dark: { bg: 'rgba(248,113,113,0.18)', fg: '#f87171' } },
};
function scoreColors(score, mode) {
  return SCORE_STYLES[score]?.[mode === 'dark' ? 'dark' : 'light'] || SCORE_STYLES.médio.light;
}

// Lucide-style icons
function FPIcon({ name, size = 20, stroke = 1.8, color = 'currentColor' }) {
  const paths = {
    'trending-up':   <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    'trending-down': <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
    'wallet':        <><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 14h2"/><path d="M20 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/></>,
    'users':         <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    'alert':         <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    'plus':          <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    'search':        <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    'bell':          <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    'home':          <><path d="M3 9.5L12 3L21 9.5V20C21 20.6 20.6 21 20 21H15V16H9V21H4C3.4 21 3 20.6 3 20V9.5Z"/></>,
    'user':          <><circle cx="12" cy="8" r="4"/><path d="M4 20C4 16.7 7.6 14 12 14C16.4 14 20 16.7 20 20"/></>,
    'list':          <><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="12" y2="17"/></>,
    'chart':         <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></>,
    'chevron-right': <polyline points="9 18 15 12 9 6"/>,
    'chevron-left':  <polyline points="15 18 9 12 15 6"/>,
    'chevron-down':  <polyline points="6 9 12 15 18 9"/>,
    'arrow-up':      <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    'arrow-down':    <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
    'check':         <polyline points="20 6 9 17 4 12"/>,
    'clock':         <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    'phone':         <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/>,
    'whatsapp':      <path d="M17.5 14.5c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.5-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4-.1-.5c-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5H7.7c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2z"/>,
    'sparkle':       <><path d="M12 3l1.9 5.8L20 10.7l-5.8 1.9L12 18.5l-1.9-5.9L4 10.7l6.1-1.9L12 3z"/></>,
    'more':          <><circle cx="12" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    'filter':        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
    'calendar':      <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    'settings':      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    'zap':           <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    'credit-card':   <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    'send':          <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    'msg':           <><path d="M21 15C21 16.1 20.1 17 19 17H7L3 21V5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V15Z"/></>,
    'download':      <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    'eye':           <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  };
  const p = paths[name] || null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{p}</svg>
  );
}

// Logo component matching login flow
function FPLogo({ light = false, size = 30 }) {
  const primary = light ? 'rgba(255,255,255,0.15)' : '#1a3f6f';
  const textColor = light ? '#fff' : '#1a1a1a';
  const subColor = light ? 'rgba(255,255,255,0.65)' : '#2558a0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size, height: size, borderRadius: size * 0.25,
        background: light ? 'rgba(255,255,255,0.15)' : '#1a3f6f',
        border: light ? '1.5px solid rgba(255,255,255,0.3)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20" fill="none">
          <rect x="2" y="4" width="16" height="10" rx="2.5" fill={light ? 'rgba(255,255,255,0.9)' : '#fff'}/>
          <path d="M6 14L5 18" stroke={light ? 'rgba(255,255,255,0.4)' : '#2558a0'} strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M14 14L15 18" stroke={light ? 'rgba(255,255,255,0.4)' : '#2558a0'} strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M3 18H17" stroke={light ? 'rgba(255,255,255,0.2)' : '#e2e0dd'} strokeWidth="1.2" strokeLinecap="round"/>
          <rect x="5" y="7" width="4" height="2.5" rx="0.8" fill={light ? '#1a3f6f' : '#1a3f6f'}/>
          <rect x="11" y="7" width="4" height="1.2" rx="0.6" fill={light ? 'rgba(255,255,255,0.35)' : '#e6eef8'}/>
          <rect x="11" y="9.3" width="3" height="1.2" rx="0.6" fill={light ? 'rgba(255,255,255,0.2)' : '#e6eef8'}/>
        </svg>
      </div>
      <span style={{ fontFamily: "'Inter', system-ui", fontWeight: 700, fontSize: size * 0.56, color: textColor, letterSpacing: -0.3 }}>
        Fiado<span style={{ color: subColor }}>Pro</span>
      </span>
    </div>
  );
}

Object.assign(window, {
  FIADO_TOKENS, FIADO_PRIMARIES, fiadoTheme, fiadoThemeStyle,
  scoreColors, FPIcon, FPAvatar, FPBtnPrimary, FPBtnOutlined, FPCard, FPLogo,
});
