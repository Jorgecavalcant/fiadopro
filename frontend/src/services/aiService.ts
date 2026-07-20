// Toda chamada de IA passa pelo backend (nunca chama OpenRouter/Gemini direto
// do navegador — evita repetir o vazamento de chave que existia com o Gemini
// embutido no bundle). Substitui `geminiService.ts` (removido).
import { CustomerWithBalance, Transaction, Language } from '../types';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const API_BASE = '/api/ai';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const message = errorBody?.error?.message || 'Falha ao falar com a IA';
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

interface AnalyzeCustomerResponse {
  success: boolean;
  analysis: string;
}

export const getFinancialAdvice = async (
  customer: CustomerWithBalance,
  transactions: Transaction[],
  language: Language
): Promise<string> => {
  const customerTransactions = transactions
    .filter((t) => t.customerId === customer.id)
    .map((t) => ({
      type: t.type,
      amount: t.amount,
      description: t.description,
      timestamp: t.timestamp,
    }));

  const result = await postJson<AnalyzeCustomerResponse>('/analyze-customer', {
    mode: 'customer',
    customer: { name: customer.name, balance: customer.balance, rawBalance: customer.rawBalance },
    transactions: customerTransactions,
    language,
  });

  return result.analysis;
};

export const getGeneralBusinessAdvice = async (
  totalReceivable: number,
  activeCustomers: number,
  language: Language
): Promise<string> => {
  const result = await postJson<AnalyzeCustomerResponse>('/analyze-customer', {
    mode: 'business',
    stats: { totalReceivable, activeCustomers },
    language,
  });

  return result.analysis;
};

interface ReadDocumentItem {
  name: string;
  price: number;
}

interface ReadDocumentResponse {
  success: boolean;
  amount?: number | null;
  description?: string | null;
  date?: string | null;
  customerName?: string | null;
  items?: ReadDocumentItem[];
}

export const extractItemsFromInvoice = async (
  base64DataWithHeader: string,
  mimeType: string
): Promise<ReadDocumentItem[]> => {
  const base64Data = base64DataWithHeader.split(',')[1] || base64DataWithHeader;

  const result = await postJson<ReadDocumentResponse>('/read-document', {
    image: { data: base64Data, mimeType },
    hint: 'recibo/nota fiscal — extrair itens individuais (ignorar total/subtotal/impostos)',
  });

  return result.items || [];
};

// Usado pelo fluxo de leitura de documento para pré-preencher um lançamento
// (valor, descrição, data, nome do cliente) — não tinha equivalente no
// geminiService.ts original, mas expõe o contrato completo de /read-document
// para quem for construir essa tela.
export const readDocument = async (
  base64DataWithHeader: string,
  mimeType: string,
  hint?: string
): Promise<ReadDocumentResponse> => {
  const base64Data = base64DataWithHeader.split(',')[1] || base64DataWithHeader;

  return postJson<ReadDocumentResponse>('/read-document', {
    image: { data: base64Data, mimeType },
    hint,
  });
};
