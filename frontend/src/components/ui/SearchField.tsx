export function SearchField({
  value,
  onChange,
  label = 'Buscar',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <input
      className="fp-search"
      type="search"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
