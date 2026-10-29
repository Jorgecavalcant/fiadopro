import React, { useState } from 'react';
import { BLOCK_REASON_LABEL } from './adminLabels';

const NOTE_MIN = 8;

export const AdminBlockDialog: React.FC<{
  userName: string;
  blocking: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (input: { reason: string; note: string }) => void;
}> = ({ userName, blocking, saving, onClose, onConfirm }) => {
  const [reason, setReason] = useState('fraude');
  const [note, setNote] = useState('');
  const noteRequired = !blocking || reason === 'judicial' || reason === 'outro';
  const noteOk = !noteRequired || note.trim().length >= NOTE_MIN;

  return (
    <div className="fp-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="fp-modal box-border w-full max-w-md p-6 sm:p-8"
        role="dialog"
        aria-labelledby="block-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="block-dialog-title" className="text-lg font-black text-slate-900 mb-2">
          {blocking ? 'Bloquear acesso' : 'Desbloquear acesso'}
        </h3>
        <p className="text-sm text-slate-500 mb-5">{userName}</p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!noteOk || saving) return;
            onConfirm({ reason, note: note.trim() });
          }}
        >
          {blocking && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest" htmlFor="block-reason">
                Motivo
              </label>
              <select
                id="block-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="fp-input"
              >
                {Object.entries(BLOCK_REASON_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest" htmlFor="block-note">
              Observação{noteRequired ? '' : ' (opcional)'}
            </label>
            <textarea
              id="block-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="fp-input min-h-24"
              maxLength={500}
              required={noteRequired}
              placeholder={blocking ? 'Descreva o motivo, sem dados pessoais' : 'Por que este acesso volta'}
            />
            <p className="text-xs text-amber-700">Não cole CPF, senha ou chave Pix nesta observação.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="fp-btn fp-btn-ghost">Cancelar</button>
            <button type="submit" disabled={!noteOk || saving} className="fp-btn fp-btn-primary disabled:opacity-40">
              {blocking ? 'Bloquear' : 'Desbloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
