import React from 'react';

type Props = {
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AccountClosedConfirm({ busy, onConfirm, onCancel }: Props) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left space-y-3" role="dialog" aria-label="Recuperar conta">
      <p className="text-sm font-bold text-slate-800">
        Esta conta foi encerrada e pode voltar. Quer recuperar a mesma conta?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="fp-btn fp-btn-primary disabled:opacity-40"
        >
          Recuperar a mesma conta
        </button>
        <button type="button" onClick={onCancel} className="fp-btn fp-btn-ghost">
          Agora não
        </button>
      </div>
    </div>
  );
};
