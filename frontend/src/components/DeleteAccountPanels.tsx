import React, { useState } from 'react';
import FullScreenModal from './FullScreenModal';
import { canConfirmDeletion } from '../utils/deleteAccountFlow';

type Props = {
  googleOnly: boolean;
  onDelete: (confirmation: string) => Promise<string | null>;
};

export default function DeleteAccountPanels({ googleOnly, onDelete }: Props) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [reason, setReason] = useState('');
  const [secretOpen, setSecretOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const closeAll = () => {
    setStep(0);
    setReason('');
    setSecretOpen(false);
    setSecret('');
    setError('');
  };

  const openSecretModal = () => {
    setStep(0);
    setReason('');
    setSecret('');
    setError('');
    setSecretOpen(true);
  };

  const submit = async () => {
    if (!canConfirmDeletion(googleOnly, secret) || loading) return;
    setLoading(true);
    setError('');
    try {
      const message = await onDelete(googleOnly ? secret.trim() : secret);
      if (message) {
        setError(message);
        return;
      }
      closeAll();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-red-50 border border-red-200 p-8 rounded-t42lg space-y-4">
        <h3 className="text-lg font-black text-red-700 flex items-center gap-2">
          Zona de Perigo
        </h3>
        <p className="text-sm text-red-600 font-medium">
          A conta fica desativada. CPF e Pix saem agora. Dá para voltar em até 30 dias com o mesmo e-mail. As pessoas, os fiados e os pagamentos desta conta são apagados depois desse prazo.
        </p>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="px-6 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-700 transition-all text-sm"
        >
          Cancelar Conta
        </button>
      </div>

      {step > 0 && (
        <FullScreenModal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-t42xl shadow-2xl p-10 space-y-6">
              {step === 1 && (
                <>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-900">Cancelar sua conta?</h3>
                    <p className="text-slate-500 mt-2 font-medium leading-relaxed">
                      A conta fica desativada. CPF e Pix saem agora. Dá para voltar em até 30 dias com o mesmo e-mail. As pessoas, os fiados e os pagamentos desta conta são apagados depois desse prazo.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={closeAll} className="flex-1 py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-600">
                      Cancelar
                    </button>
                    <button type="button" onClick={() => setStep(2)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black">
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Por que está cancelando?</h3>
                    <div className="space-y-3">
                      {['Não uso mais', 'Muito caro', 'Falta de funcionalidades', 'Migrei para outro sistema', 'Outro motivo'].map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                          onClick={() => setReason(item)}
                        >
                          <input
                            type="radio"
                            name="cancelReason"
                            value={item}
                            checked={reason === item}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <span className="font-bold text-slate-700">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-600">
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => reason && setStep(3)}
                      disabled={!reason}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black disabled:opacity-40"
                    >
                      Confirmar
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="text-center">
                    <h3 className="text-xl font-black text-red-700">Última confirmação</h3>
                    <p className="text-slate-500 mt-2 font-medium leading-relaxed">
                      A conta fica desativada. CPF e Pix saem agora. Dá para voltar em até 30 dias com o mesmo e-mail. As pessoas, os fiados e os pagamentos desta conta são apagados depois desse prazo.{' '}
                      {googleOnly
                        ? 'O próximo passo pede que você digite CANCELAR uma vez.'
                        : 'O próximo passo pede a sua senha.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button type="button" onClick={openSecretModal} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black">
                      Excluir Tudo Permanentemente
                    </button>
                    <button type="button" onClick={closeAll} className="w-full py-4 border-2 border-slate-200 rounded-2xl font-black text-slate-600">
                      Desistir — Manter minha conta
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </FullScreenModal>
      )}

      {secretOpen && (
        <FullScreenModal>
          <div
            role="dialog"
            aria-label="Excluir minha conta"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: 16,
            }}
          >
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 400, width: '100%' }}>
              <h3 style={{ color: '#dc2626', marginBottom: 8 }}>Excluir minha conta</h3>
              <p style={{ color: '#374151', marginBottom: 16, fontSize: 14 }}>
                {googleOnly
                  ? 'A conta fica desativada. CPF e Pix saem agora. Dá para voltar em até 30 dias com o mesmo e-mail. Digite CANCELAR para confirmar.'
                  : 'A conta fica desativada. CPF e Pix saem agora. Dá para voltar em até 30 dias com o mesmo e-mail. Digite sua senha para confirmar.'}
              </p>
              <input
                type={googleOnly ? 'text' : 'password'}
                aria-label={googleOnly ? 'Digite CANCELAR' : 'Senha'}
                placeholder={googleOnly ? 'CANCELAR' : 'Digite sua senha para confirmar'}
                value={secret}
                onChange={(e) => setSecret(googleOnly ? e.target.value.toUpperCase() : e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, fontSize: 14, boxSizing: 'border-box' }}
              />
              {error && (
                <p role="alert" style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={closeAll} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canConfirmDeletion(googleOnly, secret) || loading}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', fontWeight: 600 }}
                >
                  {loading ? 'Excluindo...' : 'Excluir conta'}
                </button>
              </div>
            </div>
          </div>
        </FullScreenModal>
      )}
    </>
  );
}
