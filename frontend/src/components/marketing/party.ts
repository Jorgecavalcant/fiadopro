function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function digitAt(base: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function cpfProblem(value: string): string | null {
  const doc = digits(value);
  if (doc.length !== 11 || /^(\d)\1{10}$/.test(doc)) return 'Confira o CPF.';
  const first = digitAt(doc, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitAt(doc, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(doc[9]) || second !== Number(doc[10])) return 'Confira o CPF.';
  return null;
}

export function cnpjProblem(value: string): string | null {
  const doc = digits(value);
  if (doc.length !== 14 || /^(\d)\1{13}$/.test(doc)) return 'Confira o CNPJ.';
  const first = digitAt(doc, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digitAt(doc, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(doc[12]) || second !== Number(doc[13])) return 'Confira o CNPJ.';
  return null;
}

export function phoneProblem(value: string): string | null {
  const phone = digits(value);
  if (phone.length < 10 || phone.length > 11) return 'Informe o telefone.';
  return null;
}

export function emailProblem(value: string): string | null {
  const email = value.trim();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
  return null;
}

export function pageLinkProblem(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    const image = /\.(jpe?g|png|webp)$/i.test(url.pathname);
    if (!image && /(instagram\.com|facebook\.com|fb\.com)$/.test(host)) {
      return 'Esse link é de uma página, não de uma imagem. Baixe a arte e envie o arquivo.';
    }
  } catch {
    return null;
  }
  return null;
}
