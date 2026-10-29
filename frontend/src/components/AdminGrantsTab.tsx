import React, { useCallback, useEffect, useState } from 'react';
import { formatBrDateTime } from '../utils/formatBr';
import { adminFetch } from './adminApi';

type GrantKind = 'cortesia' | 'trial' | 'cupom';
type GrantPlan = 'PRO' | 'ENTERPRISE';
type Audience = 'all' | 'selected';

interface ListedGrant {
  id: string;
  name: string;
  plan: string;
  source: string;
  expiresAt: string | null;
}

interface ListedPromotion {
  id: string;
  plan: string;
  source: string;
  audience: string;
  expiresAt: string;
  userCount: number;
}

const SOURCE_LABEL: Record<string, string> = {
  cortesia: 'Cortesia',
  trial: 'Teste grátis',
  cupom: 'Cupom',
  promocao: 'Promoção',
};

const PLAN_LABEL: Record<string, string> = {
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

function formatWhen(value: string | null) {
  if (!value) return 'Sem prazo';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatBrDateTime(date);
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseIds(raw: string) {
  return raw
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export const AdminGrantsTab: React.FC = () => {
  const [grants, setGrants] = useState<ListedGrant[]>([]);
  const [promotions, setPromotions] = useState<ListedPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState('');
  const [kind, setKind] = useState<GrantKind>('cortesia');
  const [plan, setPlan] = useState<GrantPlan>('PRO');
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');

  const [promoPlan, setPromoPlan] = useState<GrantPlan>('PRO');
  const [audience, setAudience] = useState<Audience>('all');
  const [userIds, setUserIds] = useState('');
  const [promoExpires, setPromoExpires] = useState('');
  const [promoNote, setPromoNote] = useState('');
  const [promoSource, setPromoSource] = useState<'promocao' | 'cupom'>('promocao');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<{ grants: ListedGrant[]; promotions: ListedPromotion[] }>(
        '/grants',
      );
      setGrants(data.grants);
      setPromotions(data.promotions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar as concessões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await adminFetch('/grants', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId.trim(),
          kind,
          plan: kind === 'trial' ? undefined : plan,
          expiresAt: kind === 'trial' ? undefined : toIso(expiresAt),
          note: note.trim(),
        }),
      });
      setNote('');
      setExpiresAt('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível conceder o plano');
    } finally {
      setSaving(false);
    }
  };

  const promote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const when = toIso(promoExpires);
    if (!when) {
      setSaving(false);
      setError('Informe um prazo futuro.');
      return;
    }
    try {
      const ids = parseIds(userIds);
      await adminFetch('/promotions', {
        method: 'POST',
        body: JSON.stringify({
          plan: promoPlan,
          expiresAt: when,
          audience,
          userIds: audience === 'selected' ? ids : undefined,
          note: promoNote.trim(),
          source: promoSource,
        }),
      });
      setPromoNote('');
      setUserIds('');
      setPromoExpires('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a promoção');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 font-medium">
        Cortesia, teste de 14 dias, cupom e promoção saem daqui. Vencido o prazo, a pessoa volta ao
        plano pago ou ao Free. A lista mostra o nome só com a inicial.
      </p>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <form className="fp-card p-5 space-y-4" onSubmit={(event) => void grant(event)}>
        <h3 className="text-lg font-black text-slate-900">Conceder plano</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="grant-user"
            >
              Identificador da pessoa
            </label>
            <input
              id="grant-user"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="fp-input"
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="grant-kind"
            >
              Tipo
            </label>
            <select
              id="grant-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as GrantKind)}
              className="fp-input"
            >
              <option value="cortesia">Cortesia</option>
              <option value="trial">Teste grátis</option>
              <option value="cupom">Cupom</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="grant-plan"
            >
              Plano
            </label>
            <select
              id="grant-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value as GrantPlan)}
              className="fp-input"
              disabled={kind === 'trial'}
            >
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="grant-until"
            >
              Prazo
            </label>
            <input
              id="grant-until"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="fp-input"
              disabled={kind === 'trial'}
              required={kind === 'cupom'}
            />
            <p className="text-xs text-slate-500">
              {kind === 'trial'
                ? 'O teste dura 14 dias e só pode ser usado uma vez. O prazo é calculado no servidor.'
                : kind === 'cortesia'
                  ? 'Em branco, a cortesia vale até alguém limpar.'
                  : 'O cupom precisa de um prazo futuro.'}
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="grant-note"
            >
              Observação
            </label>
            <textarea
              id="grant-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="fp-input min-h-24"
              maxLength={500}
              required
              placeholder="Por que esta pessoa recebe o plano"
            />
            <p className="text-xs text-amber-700">
              Não cole CPF, senha, e-mail ou chave Pix nesta observação.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || note.trim().length < 8}
          className="fp-btn fp-btn-primary disabled:opacity-40"
        >
          Conceder
        </button>
      </form>

      <form className="fp-card p-5 space-y-4" onSubmit={(event) => void promote(event)}>
        <h3 className="text-lg font-black text-slate-900">Promoção</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="promo-plan"
            >
              Plano
            </label>
            <select
              id="promo-plan"
              value={promoPlan}
              onChange={(event) => setPromoPlan(event.target.value as GrantPlan)}
              className="fp-input"
            >
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="promo-audience"
            >
              Audiência
            </label>
            <select
              id="promo-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as Audience)}
              className="fp-input"
            >
              <option value="all">Base inteira</option>
              <option value="selected">Lista</option>
            </select>
          </div>
          {audience === 'selected' && (
            <div className="space-y-1 sm:col-span-2">
              <label
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
                htmlFor="promo-ids"
              >
                Identificadores
              </label>
              <textarea
                id="promo-ids"
                value={userIds}
                onChange={(event) => setUserIds(event.target.value)}
                className="fp-input min-h-24"
                required
                placeholder="Um identificador por linha"
              />
            </div>
          )}
          <div className="space-y-1">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="promo-until"
            >
              Prazo
            </label>
            <input
              id="promo-until"
              type="datetime-local"
              value={promoExpires}
              onChange={(event) => setPromoExpires(event.target.value)}
              className="fp-input"
              required
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="promo-source"
            >
              Origem
            </label>
            <select
              id="promo-source"
              value={promoSource}
              onChange={(event) => setPromoSource(event.target.value as 'promocao' | 'cupom')}
              className="fp-input"
            >
              <option value="promocao">Promoção</option>
              <option value="cupom">Cupom</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest"
              htmlFor="promo-note"
            >
              Observação
            </label>
            <textarea
              id="promo-note"
              value={promoNote}
              onChange={(event) => setPromoNote(event.target.value)}
              className="fp-input min-h-24"
              maxLength={500}
              required
              placeholder="Por que esta promoção existe"
            />
            <p className="text-xs text-amber-700">
              Não cole CPF, senha, e-mail ou chave Pix nesta observação.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || promoNote.trim().length < 8}
          className="fp-btn fp-btn-primary disabled:opacity-40"
        >
          Criar promoção
        </button>
      </form>

      <div className="fp-card">
        {loading ? (
          <p className="text-slate-400 font-semibold py-16 text-center">Carregando...</p>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="px-4 pt-4 text-sm font-black text-slate-900">Concessões vigentes</h3>
              <table className="fp-table">
                <thead className="hidden sm:table-header-group">
                  <tr>
                    <th>Nome</th>
                    <th>Plano</th>
                    <th>Origem</th>
                    <th>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((item) => (
                    <tr key={item.id} className="block border-b border-slate-100 sm:table-row">
                      <td className="block font-bold text-slate-800 sm:table-cell">{item.name}</td>
                      <td className="block sm:table-cell">{PLAN_LABEL[item.plan] || item.plan}</td>
                      <td className="block sm:table-cell">
                        {SOURCE_LABEL[item.source] || item.source}
                      </td>
                      <td className="block sm:table-cell">{formatWhen(item.expiresAt)}</td>
                    </tr>
                  ))}
                  {grants.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-400 py-10">
                        Nenhuma concessão vigente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="px-4 text-sm font-black text-slate-900">Promoções vigentes</h3>
              <table className="fp-table">
                <thead className="hidden sm:table-header-group">
                  <tr>
                    <th>Plano</th>
                    <th>Origem</th>
                    <th>Audiência</th>
                    <th>Pessoas</th>
                    <th>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((item) => (
                    <tr key={item.id} className="block border-b border-slate-100 sm:table-row">
                      <td className="block font-bold text-slate-800 sm:table-cell">
                        {PLAN_LABEL[item.plan] || item.plan}
                      </td>
                      <td className="block sm:table-cell">
                        {SOURCE_LABEL[item.source] || item.source}
                      </td>
                      <td className="block sm:table-cell">
                        {item.audience === 'all' ? 'Base inteira' : 'Lista'}
                      </td>
                      <td className="block sm:table-cell">{item.userCount}</td>
                      <td className="block sm:table-cell">{formatWhen(item.expiresAt)}</td>
                    </tr>
                  ))}
                  {promotions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-10">
                        Nenhuma promoção vigente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
