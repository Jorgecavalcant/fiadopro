import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { cnpjProblem, cpfProblem, emailProblem, phoneProblem } from './party';
import { sponsorFetch } from './sponsorApi';

type Kind = 'pj' | 'pf';

const EMPTY = {
  tipo: 'pj' as Kind,
  nome: '',
  razao: '',
  documento: '',
  categoria: 'Padaria',
  endereco: '',
  cidade: '',
  uf: 'GO',
  representante: '',
  cargo: '',
  telefone: '',
  email: '',
};

export function SponsorStep({
  sponsorId,
  saving,
  onSaving,
  onSaved,
}: {
  sponsorId: string | null;
  saving: boolean;
  onSaving: (value: boolean) => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sponsorId) return;
    sponsorFetch<{ sponsor: Record<string, string | null> }>(`/${sponsorId}`)
      .then((data) => {
        const row = data.sponsor;
        setForm({
          tipo: row.tipo_pessoa === 'pf' ? 'pf' : 'pj',
          nome: row.nome || '',
          razao: row.razao_social || '',
          documento: row.documento || '',
          categoria: row.categoria || 'Padaria',
          endereco: row.endereco || '',
          cidade: row.cidade || '',
          uf: row.uf || 'GO',
          representante: row.representante_nome || '',
          cargo: row.representante_cargo || '',
          telefone: row.telefone || '',
          email: row.email || '',
        });
      })
      .catch(() => undefined);
  }, [sponsorId]);

  function set(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    const next: Record<string, string> = {};
    if (!form.nome.trim()) next.nome = 'Informe o nome.';
    if (form.tipo === 'pj' && !form.razao.trim()) next.razao = 'Informe a razão social.';
    const doc = form.tipo === 'pj' ? cnpjProblem(form.documento) : cpfProblem(form.documento);
    if (doc) next.documento = doc;
    if (!form.endereco.trim()) next.endereco = 'Informe o endereço.';
    if (!form.cidade.trim()) next.cidade = 'Informe a cidade.';
    if (form.tipo === 'pj' && !form.representante.trim()) next.representante = 'Informe o representante.';
    if (form.tipo === 'pj' && !form.cargo.trim()) next.cargo = 'Informe o cargo.';
    const phone = phoneProblem(form.telefone);
    const email = emailProblem(form.email);
    if (phone) next.telefone = phone;
    if (email) next.email = email;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`sponsor-${first}`)?.focus();
      return;
    }
    onSaving(true);
    const body = {
      tipo_pessoa: form.tipo,
      nome: form.nome.trim(),
      razao_social: form.razao.trim() || null,
      documento: form.documento,
      categoria: form.categoria,
      endereco: form.endereco.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf,
      representante_nome: form.representante.trim() || null,
      representante_cargo: form.cargo.trim() || null,
      telefone: form.telefone,
      email: form.email.trim(),
    };
    try {
      const data = sponsorId
        ? await sponsorFetch<{ sponsor: { id: string } }>(`/${sponsorId}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await sponsorFetch<{ sponsor: { id: string } }>('/', { method: 'POST', body: JSON.stringify(body) });
      onSaved(data.sponsor.id);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Não consegui salvar.' });
    } finally {
      onSaving(false);
    }
  }

  return (
    <form className="fp-flow-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <h3>Dados do patrocinador</h3>
      <p>Usados no contrato formal. Campos com * são obrigatórios.</p>
      <div className="fp-choice" role="group" aria-label="Tipo de pessoa">
        <button type="button" className={form.tipo === 'pj' ? 'on' : ''} onClick={() => set('tipo', 'pj')}>Pessoa jurídica</button>
        <button type="button" className={form.tipo === 'pf' ? 'on' : ''} onClick={() => set('tipo', 'pf')}>Pessoa física</button>
      </div>
      <div className="fp-flow-grid">
        <label>{form.tipo === 'pj' ? 'Nome fantasia' : 'Nome completo'}<input id="sponsor-nome" aria-label={form.tipo === 'pj' ? 'Nome fantasia' : 'Nome completo'} value={form.nome} onChange={(event) => set('nome', event.target.value)} />{errors.nome ? <span className="fp-field-error">{errors.nome}</span> : null}</label>
        {form.tipo === 'pj' ? <label>Razão social<input id="sponsor-razao" aria-label="Razão social" value={form.razao} onChange={(event) => set('razao', event.target.value)} />{errors.razao ? <span className="fp-field-error">{errors.razao}</span> : null}</label> : null}
        <label>{form.tipo === 'pj' ? 'CNPJ' : 'CPF'}<input id="sponsor-documento" aria-label={form.tipo === 'pj' ? 'CNPJ' : 'CPF'} value={form.documento} onChange={(event) => set('documento', event.target.value)} />{errors.documento ? <span className="fp-field-error">{errors.documento}</span> : null}</label>
        <label>Categoria<select aria-label="Categoria" value={form.categoria} onChange={(event) => set('categoria', event.target.value)}><option>Padaria</option><option>Farmácia</option><option>Mercado</option><option>Serviços</option><option>Outro</option></select></label>
        <label>Endereço<input id="sponsor-endereco" aria-label="Endereço" value={form.endereco} onChange={(event) => set('endereco', event.target.value)} />{errors.endereco ? <span className="fp-field-error">{errors.endereco}</span> : null}</label>
        <label>Cidade<input id="sponsor-cidade" aria-label="Cidade" value={form.cidade} onChange={(event) => set('cidade', event.target.value)} />{errors.cidade ? <span className="fp-field-error">{errors.cidade}</span> : null}</label>
        <label>UF<input aria-label="UF" value={form.uf} maxLength={2} onChange={(event) => set('uf', event.target.value.toUpperCase())} /></label>
        {form.tipo === 'pj' ? <label>Representante legal · nome<input id="sponsor-representante" aria-label="Representante" value={form.representante} onChange={(event) => set('representante', event.target.value)} />{errors.representante ? <span className="fp-field-error">{errors.representante}</span> : null}</label> : null}
        {form.tipo === 'pj' ? <label>Representante legal · cargo<input id="sponsor-cargo" aria-label="Cargo" value={form.cargo} onChange={(event) => set('cargo', event.target.value)} />{errors.cargo ? <span className="fp-field-error">{errors.cargo}</span> : null}</label> : null}
        <label>Telefone *<input id="sponsor-telefone" aria-label="Telefone" value={form.telefone} onChange={(event) => set('telefone', event.target.value)} />{errors.telefone ? <span className="fp-field-error">{errors.telefone}</span> : null}</label>
        <label>E-mail *<input id="sponsor-email" aria-label="E-mail" value={form.email} onChange={(event) => set('email', event.target.value)} />{errors.email ? <span className="fp-field-error">{errors.email}</span> : null}</label>
      </div>
      <p className="fp-flow-note">Esses dados vão só para o contrato e só o admin vê.</p>
      {errors.form ? <p className="fp-field-error">{errors.form}</p> : null}
      <div className="fp-flow-actions"><span /><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar e continuar'}</Button></div>
    </form>
  );
}
