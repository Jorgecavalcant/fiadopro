import { SponsorRuleError } from './sponsors.js';

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function digitAt(base: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function cpfDigits(value: string): string {
  const doc = digits(value);
  if (doc.length !== 11 || /^(\d)\1{10}$/.test(doc)) {
    throw new SponsorRuleError('Confira o CPF.');
  }
  const first = digitAt(doc, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitAt(doc, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(doc[9]) || second !== Number(doc[10])) {
    throw new SponsorRuleError('Confira o CPF.');
  }
  return doc;
}

export function cnpjDigits(value: string): string {
  const doc = digits(value);
  if (doc.length !== 14 || /^(\d)\1{13}$/.test(doc)) {
    throw new SponsorRuleError('Confira o CNPJ.');
  }
  const first = digitAt(doc, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitAt(doc, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(doc[12]) || second !== Number(doc[13])) {
    throw new SponsorRuleError('Confira o CNPJ.');
  }
  return doc;
}

export function maskDocument(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length === 11) return `***.***.***-${value.slice(9)}`;
  if (value.length === 14) return `**.***.***/${value.slice(8, 12)}-${value.slice(12)}`;
  return null;
}

export function phoneDigits(value: string): string {
  const phone = digits(value);
  if (phone.length < 10 || phone.length > 11) throw new SponsorRuleError('Informe o telefone.');
  return phone;
}

export function emailAddress(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SponsorRuleError('Informe um e-mail válido.');
  }
  return email;
}

export const TECH42 = {
  razao: 'TECH 42 LTDA',
  fantasia: 'TECH 42',
  cnpj: '66.499.920/0001-04',
  endereco: 'Avenida Comercial, 814, Quadra 61, Lote 10, Sala 1, Bairro da Vitória, Goiânia/GO, CEP 74477-012',
  cidade: 'Goiânia',
  uf: 'GO',
};
