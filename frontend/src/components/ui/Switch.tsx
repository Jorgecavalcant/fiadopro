/** Interruptor do padrão: trilho, bolinha e área de toque de 44px. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="fp-switch-hit"
      onClick={() => onChange(!checked)}
    >
      <span className={checked ? 'fp-switch on' : 'fp-switch'} aria-hidden="true" />
      <span className="fp-switch-label">{label}</span>
    </button>
  );
}
