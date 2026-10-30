/** Nome do lançamento inteiro, em até duas linhas, sem reticências. */
export function LedgerTitle({ text }: { text: string }) {
  return <strong className="fp-ledger-title">{text}</strong>;
}
