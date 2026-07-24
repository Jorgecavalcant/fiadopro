import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  BarChart3,
  Settings as SettingsIcon,
  FileBarChart,
  Search,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Pencil,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://www.fiadopro.com.br/api';

/* ============================================================
 * Tipos (espelham o envelope { success, ... } do backend /api/admin/*)
 * ============================================================ */
type AdminTab = 'users' | 'metrics' | 'settings' | 'reports';

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UsersMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MonthlyVolumeRow {
  month: string;
  volume: string;
  count: number;
}

interface Metrics {
  activeUsers: number;
  customers: number;
  transactions: number;
  monthlyVolume: MonthlyVolumeRow[];
}

type SettingsKey = 'features' | 'limits' | 'geral';
const SETTINGS_KEYS: SettingsKey[] = ['features', 'limits', 'geral'];

interface ReportRow {
  month: string;
  type: string;
  total: string;
  count: number;
}

/* ============================================================
 * Cliente HTTP mínimo — sempre credentials:'include' (cookie httpOnly)
 * ============================================================ */
interface ApiEnvelope {
  success?: boolean;
  error?: { message?: string };
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/admin${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let data: ApiEnvelope | null = null;
  try {
    data = await res.json();
  } catch {
    // corpo vazio ou nao-JSON
  }
  if (!res.ok || !data?.success) {
    throw new Error(data?.error?.message || `Falha na requisição (${res.status})`);
  }
  return data as T;
}

/* ============================================================
 * Componente raiz
 * ============================================================ */
const AdminPanel: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('users');

  const tabs: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'metrics', label: 'Métricas', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon },
    { id: 'reports', label: 'Relatórios', icon: FileBarChart },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Painel Administrativo</h2>
        <p className="text-slate-400 font-semibold text-sm">
          Usuários, métricas, configurações e relatórios do sistema
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'metrics' && <MetricsTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
};

/* ============================================================
 * Helpers de UI compartilhados
 * ============================================================ */
const LoadingBlock: React.FC = () => (
  <div className="flex items-center justify-center gap-2 text-slate-400 font-semibold py-16">
    <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
  </div>
);

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 bg-red-50 text-red-600 font-semibold text-sm rounded-2xl px-4 py-3">
    <AlertCircle className="w-4 h-4 shrink-0" /> {message}
  </div>
);

/* ============================================================
 * Aba: Usuários
 * ============================================================ */
const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<UsersMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' });
  const [savingId, setSavingId] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const data = await adminFetch<{ users: AdminUser[]; meta: UsersMeta }>(
        `/users?${params.toString()}`,
      );
      setUsers(data.users);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const toggleActive = async (user: AdminUser) => {
    const nextActive = !user.is_active;
    if (!nextActive && !window.confirm(`Desativar o acesso de ${user.full_name || user.email}?`))
      return;
    setSavingId(user.id);
    try {
      const data = await adminFetch<{ user: AdminUser }>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive }),
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setSavingId(null);
    }
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({ full_name: user.full_name || '', phone: user.phone || '' });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingId(editingUser.id);
    try {
      const data = await adminFetch<{ user: AdminUser }>(`/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ full_name: editForm.full_name, phone: editForm.phone || null }),
      });
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)));
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar usuário');
    } finally {
      setSavingId(null);
    }
  };

  const resetPassword = async (user: AdminUser) => {
    if (!window.confirm(`Enviar e-mail de redefinição de senha para ${user.email}?`)) return;
    setSavingId(user.id);
    try {
      await adminFetch(`/users/${user.id}/reset-password`, { method: 'POST' });
      window.alert('E-mail de redefinição enviado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar redefinição de senha');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="fp-input pl-10"
          />
        </div>
        <button type="submit" className="fp-btn fp-btn-primary">
          Buscar
        </button>
      </form>

      {error && <ErrorBanner message={error} />}

      <div className="fp-card overflow-x-auto">
        {loading ? (
          <LoadingBlock />
        ) : (
          <table className="fp-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th>Papel</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-bold text-slate-800">{u.full_name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <span
                      className={`fp-badge ${u.role === 'admin' ? 'fp-badge-purple' : 'fp-badge-muted'}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`fp-badge ${u.is_active ? 'fp-badge-success' : 'fp-badge-danger'}`}
                    >
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        title="Editar"
                        onClick={() => openEdit(u)}
                        disabled={savingId === u.id}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        title={u.is_active ? 'Desativar' : 'Ativar'}
                        onClick={() => toggleActive(u)}
                        disabled={savingId === u.id}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {u.is_active ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <ShieldCheck className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        title="Redefinir senha"
                        onClick={() => resetPassword(u)}
                        disabled={savingId === u.id}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-10">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm font-semibold text-slate-500">
          <span>
            {meta.total} usuário(s) — página {meta.page} de {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="fp-btn fp-btn-ghost disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="fp-btn fp-btn-ghost disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          className="fp-overlay flex items-center justify-center p-4"
          onClick={() => setEditingUser(null)}
        >
          <div className="fp-modal w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900 mb-6">Editar usuário</h3>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Nome completo
                </label>
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="fp-input"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Telefone
                </label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="fp-input"
                  maxLength={20}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="fp-btn fp-btn-ghost flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingId === editingUser.id}
                  className="fp-btn fp-btn-primary flex-1 disabled:opacity-60"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
 * Aba: Métricas
 * ============================================================ */
const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await adminFetch<{ metrics: Metrics }>('/metrics');
        if (!cancelled) setMetrics(data.metrics);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar métricas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBanner message={error} />;
  if (!metrics) return null;

  const maxVolume = Math.max(1, ...metrics.monthlyVolume.map((m) => Number(m.volume) || 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Usuários ativos" value={metrics.activeUsers} />
        <StatCard label="Clientes cadastrados" value={metrics.customers} />
        <StatCard label="Transações" value={metrics.transactions} />
      </div>

      <div className="fp-card p-6">
        <h3 className="fp-section-title">Volume mensal (últimos 12 meses)</h3>
        <div className="space-y-2 mt-4">
          {metrics.monthlyVolume.map((row) => {
            const volume = Number(row.volume) || 0;
            const pct = Math.max(2, Math.round((volume / maxVolume) * 100));
            return (
              <div key={row.month} className="flex items-center gap-3">
                <span className="w-16 text-xs font-bold text-slate-400 shrink-0">{row.month}</span>
                <div className="flex-1 fp-progress">
                  <div
                    className="fp-progress-fill"
                    style={{ width: `${pct}%`, background: 'var(--fp-primary)' }}
                  />
                </div>
                <span className="w-32 text-right text-xs font-bold text-slate-600 shrink-0">
                  R$ {volume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({row.count})
                </span>
              </div>
            );
          })}
          {metrics.monthlyVolume.length === 0 && (
            <p className="text-slate-400 text-sm py-4">Sem movimentação confirmada no período.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="fp-stat-card primary">
    <p className="fp-section-title mb-2">{label}</p>
    <p className="text-3xl font-black text-slate-900">{value.toLocaleString('pt-BR')}</p>
  </div>
);

/* ============================================================
 * Aba: Configurações (chave/valor, allowlist)
 * ============================================================ */
const SettingsTab: React.FC = () => {
  const [key, setKey] = useState<SettingsKey>('features');
  const [rawValue, setRawValue] = useState('{}');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const load = useCallback(async (k: SettingsKey) => {
    setLoading(true);
    setError('');
    setSavedMessage('');
    try {
      const data = await adminFetch<{ value: unknown; updated_at: string | null }>(
        `/settings/${k}`,
      );
      setRawValue(JSON.stringify(data.value ?? {}, null, 2));
      setUpdatedAt(data.updated_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(key);
  }, [key, load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const parsed = JSON.parse(rawValue);
      const data = await adminFetch<{ value: unknown; updated_at: string }>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: parsed }),
      });
      setRawValue(JSON.stringify(data.value ?? {}, null, 2));
      setUpdatedAt(data.updated_at);
      setSavedMessage('Configuração salva com sucesso.');
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? 'JSON inválido — corrija antes de salvar.'
          : err instanceof Error
            ? err.message
            : 'Erro ao salvar configuração',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fp-card p-6 max-w-2xl space-y-4">
      <div className="flex gap-2">
        {SETTINGS_KEYS.map((k) => (
          <button
            key={k}
            onClick={() => setKey(k)}
            className={`fp-badge ${key === k ? 'fp-badge-primary' : 'fp-badge-muted'}`}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            {k}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}
      {savedMessage && <p className="text-sm font-semibold text-emerald-600">{savedMessage}</p>}

      {loading ? (
        <LoadingBlock />
      ) : (
        <form onSubmit={save} className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Valor (JSON) — chave &quot;{key}&quot;
          </label>
          <textarea
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            rows={10}
            className="fp-input font-mono text-xs"
            spellCheck={false}
          />
          {updatedAt && (
            <p className="text-xs text-slate-400">
              Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="fp-btn fp-btn-primary disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      )}
    </div>
  );
};

/* ============================================================
 * Aba: Relatórios
 * ============================================================ */
const ReportsTab: React.FC = () => {
  const [months, setMonths] = useState(12);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (m: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<{ months: number; report: ReportRow[] }>(
        `/reports?months=${m}`,
      );
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(months);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load(months);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Meses (máx. 60)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={months}
            onChange={(e) => setMonths(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
            className="fp-input w-32"
          />
        </div>
        <button type="submit" className="fp-btn fp-btn-primary">
          Gerar
        </button>
      </form>

      {error && <ErrorBanner message={error} />}

      <div className="fp-card overflow-x-auto">
        {loading ? (
          <LoadingBlock />
        ) : (
          <table className="fp-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Tipo</th>
                <th>Total</th>
                <th>Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {report.map((row, i) => (
                <tr key={`${row.month}-${row.type}-${i}`}>
                  <td className="font-bold text-slate-800">{row.month}</td>
                  <td>{row.type}</td>
                  <td>
                    R${' '}
                    {(Number(row.total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))}
              {report.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-slate-400 py-10">
                    Sem dados no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
