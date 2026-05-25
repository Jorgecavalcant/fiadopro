import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export const getGeminiModel = () => {
  // Using gemini-1.5-flash (gemini-pro is deprecated)
  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
  });
};

export const sendMessage = async (prompt: string): Promise<string> => {
  const model = getGeminiModel();

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    // TEMPORARY: Return demo response while API key is being fixed
    console.warn('Using demo response (Gemini API not available - API key needs to be rotated)');
    return generateDemoResponse(prompt);
  }
};

// Demo response generator (remove after API key is fixed)
const generateDemoResponse = (prompt: string): string => {
  const responses: Record<string, string> = {
    'reduzir': 'Para reduzir suas dívidas: 1) Liste todas as dívidas, 2) Priorize as maiores, 3) Negocie com credores, 4) Crie um plano de pagamento, 5) Acompanhe o progresso regularmente.',
    'dívida': 'A melhor estratégia é o método "bola de neve" - pague o mínimo em todas as contas e concentre-se na menor dívida primeiro.',
    'crédito': 'Sua pontuação de crédito pode melhorar em 3-6 meses ao pagar as contas em dia. Acompanhe seu histórico regularmente.',
    'default': 'Para gerenciar melhor suas finanças pessoais: 1) Crie um orçamento, 2) Reduza despesas desnecessárias, 3) Aumente sua renda, 4) Invista em educação financeira, 5) Busque ajuda profissional se necessário.'
  };

  const key = Object.keys(responses).find(k => prompt.toLowerCase().includes(k));
  return key ? responses[key] : responses['default'];
};
