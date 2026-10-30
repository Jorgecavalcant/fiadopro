export function Chip({
  label,
  selected = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`fp-chip${selected ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}
