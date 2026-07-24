// Painel de configuração da IA (frente ADMIN monta este componente dentro de
// AdminPanel.tsx — ver docs/SPEC-PRODUCAO-V2.md, seção "Frente IA"). Chama
// GET/PUT /api/admin/ai-config (requireAuth + requireAdmin no backend).
import React, { useEffect, useState } from 'react';
import { Bot, Loader2, Save } from 'lucide-react';

interface AiConfigState {
  chat_model: string;
  vision_model: string;
  enabled: boolean;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const API_URL = '/api/admin/ai-config';

async function requestJson<T>(method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  const response = await fetch(API_URL, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(errorBody?.error?.message || 'Falha ao falar com o servidor');
  }

  return response.json() as Promise<T>;
}

const AdminAIConfig: React.FC = () => {
  const [config, setConfig] = useState<AiConfigState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await requestJson<{ success: boolean; config: AiConfigState }>('GET');
        if (!cancelled) setConfig(result.config);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erro ao carregar configuração');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const result = await requestJson<{ success: boolean; config: AiConfigState }>('PUT', {
        chatModel: config.chat_model,
        visionModel: config.vision_model,
        enabled: config.enabled,
      });
      setConfig(result.config);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 24, color: '#64748B' }}
      >
        <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
        Carregando configuração de IA...
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: 24, color: '#B91C1C' }}>
        {error || 'Não foi possível carregar a configuração de IA.'}
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot style={{ width: 18, height: 18, color: 'white' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Configuração de IA
          </h2>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
            Modelos via OpenRouter (gratuitos por padrão)
          </p>
        </div>
      </div>

      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: '#334155',
          marginBottom: 6,
        }}
      >
        Modelo de chat (análise de cliente / dicas de negócio)
      </label>
      <input
        type="text"
        value={config.chat_model}
        onChange={(e) => setConfig({ ...config, chat_model: e.target.value })}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          fontSize: 13,
          marginBottom: 16,
        }}
      />

      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 700,
          color: '#334155',
          marginBottom: 6,
        }}
      >
        Modelo de visão (leitura de documento/imagem)
      </label>
      <input
        type="text"
        value={config.vision_model}
        onChange={(e) => setConfig({ ...config, vision_model: e.target.value })}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          fontSize: 13,
          marginBottom: 16,
        }}
      />

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 700,
          color: '#334155',
          marginBottom: 20,
        }}
      >
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />
        IA ativada
      </label>

      {error && <p style={{ color: '#B91C1C', fontSize: 12, marginBottom: 12 }}>{error}</p>}
      {savedAt && !error && (
        <p style={{ color: '#15803D', fontSize: 12, marginBottom: 12 }}>Configuração salva.</p>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
          color: 'white',
          fontWeight: 800,
          fontSize: 13,
          cursor: isSaving ? 'default' : 'pointer',
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? (
          <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
        ) : (
          <Save style={{ width: 15, height: 15 }} />
        )}
        Salvar
      </button>
    </div>
  );
};

export default AdminAIConfig;
