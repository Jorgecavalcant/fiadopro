import React from 'react';

/** Igual a normalizePhone do servidor: só dígitos, sem DDI 55 e sem zero à esquerda. */
export function normalizeCustomerPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits === '') return '';
  const semDdi = digits.length >= 12 && digits.startsWith('55') ? digits.slice(2) : digits;
  return semDdi.replace(/^0+/, '');
}

/** Aviso de celular já cadastrado, com atalho para o cliente que já existe. */
export function DuplicateCustomerNotice({
  message,
  onOpen,
}: {
  message: string;
  onOpen: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        background: '#FFF7ED',
        border: '1.5px solid #FDBA74',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <p style={{ color: '#9A3412', fontWeight: 800, margin: '0 0 12px' }}>{message}</p>
      <button
        type="button"
        onClick={onOpen}
        style={{
          background: '#9A3412',
          color: 'white',
          border: 'none',
          borderRadius: 12,
          padding: '12px 16px',
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        Abrir cadastro
      </button>
    </div>
  );
}
