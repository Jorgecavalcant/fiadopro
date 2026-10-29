import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  BarChart3,
  ClipboardList,
  Archive,
  Gift,
  Search,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Pencil,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { adminFetch } from './adminApi';
import { AdminAuditTab } from './AdminAuditTab';
import { AdminBlockDialog } from './AdminBlockDialog';
import { AdminClosedTab } from './AdminClosedTab';
import { AdminGrantsTab } from './AdminGrantsTab';
import { AdminOverviewTab } from './AdminOverviewTab';
import { BLOCK_REASON_LABEL } from './adminLabels';

/* ============================================================
 * Tipos (espelham o envelope { success, ... } do backend /api/admin/*)
 * ============================================================ */
type AdminTab = 'users' | 'overview' | 'grants' | 'audit' | 'closed';

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
  block_reason?: string | null;
  block_note?: string | null;
  legal_hold?: boolean;
  blocked_at?: string | null;
}

interface UsersMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ============================================================
 * Cliente HTTP mínimo — sempre credentials:'include' (cookie httpOnly)
 * ============================================================ */
/* ============================================================
 * Componente raiz
 * ============================================================ */
const AdminPanel: React.FC<{ currentUserId?: string }> = ({ currentUserId }) => {
  const [tab, setTab] = useState<AdminTab>('users');

  const tabs: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'overview', label: 'Visão geral', icon: BarChart3 },
    { id: 'grants', label: 'Concessões', icon: Gift },
    { id: 'audit', label: 'Registro', icon: ClipboardList },
    { id: 'closed', label: 'Contas encerradas', icon: Archive },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Painel Administrativo</h2>
        <p className="text-slate-400 font-semibold text-sm">
          Usuários, visão geral, concessões, registro e contas encerradas
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

      {tab === 'users' && <UsersTab currentUserId={currentUserId} />}
      {tab === 'overview' && <AdminOverviewTab />}
      {tab === 'grants' && <AdminGrantsTab />}
      {tab === 'audit' && <AdminAuditTab />}
      {tab === 'closed' && <AdminClosedTab />}
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
const UsersTab: React.FC<{ currentUserId?: string }> = ({ currentUserId }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<UsersMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [accessUser, setAccessUser] = useState<AdminUser | null>(null);
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

  const confirmAccess = async (input: { reason: string; note: string }) => {
    if (!accessUser) return;
    const blocking = accessUser.is_active;
    setSavingId(accessUser.id);
    try {
      const data = await adminFetch<{ user: AdminUser }>(`/users/${accessUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          blocking
            ? { is_active: false, block_reason: input.reason, block_note: input.note || undefined }
            : { is_active: true, unblock_note: input.note },
        ),
      });
      setUsers((prev) => prev.map((u) => (u.id === accessUser.id ? data.user : u)));
      setAccessUser(null);
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
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`fp-badge ${u.is_active ? 'fp-badge-success' : 'fp-badge-danger'}`}
                      >
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      {(u.legal_hold || u.block_reason) && (
                        <span
                          className={`fp-badge ${u.legal_hold ? 'fp-badge-danger' : 'fp-badge-warning'}`}
                          title={
                            u.block_note || BLOCK_REASON_LABEL[u.block_reason || ''] || 'Bloqueio'
                          }
                        >
                          {u.legal_hold
                            ? 'Judicial'
                            : BLOCK_REASON_LABEL[u.block_reason || ''] || u.block_reason}
                        </span>
                      )}
                    </div>
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
                      {currentUserId === u.id && u.is_active ? (
                        <button
                          type="button"
                          aria-label="Bloquear a própria conta"
                          title="Você não pode bloquear a sua própria conta"
                          disabled
                          className="p-2 rounded-xl text-slate-300 cursor-not-allowed"
                        >
                          <ShieldOff className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={u.is_active ? 'Bloquear acesso' : 'Desbloquear acesso'}
                          title={u.is_active ? 'Desativar' : 'Ativar'}
                          onClick={() => setAccessUser(u)}
                          disabled={savingId === u.id}
                          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {u.is_active ? (
                            <ShieldOff className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </button>
                      )}
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

      {accessUser && (
        <AdminBlockDialog
          userName={accessUser.full_name || accessUser.email}
          blocking={accessUser.is_active}
          saving={savingId === accessUser.id}
          onClose={() => setAccessUser(null)}
          onConfirm={confirmAccess}
        />
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

export default AdminPanel;
