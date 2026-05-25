
import { GoogleGenAI, Type } from "@google/genai";
import { CustomerWithBalance, Transaction, Language } from "../types";

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getFinancialAdvice = async (
  customer: CustomerWithBalance,
  transactions: Transaction[],
  language: Language
) => {
  const ai = getAI();
  const history = transactions
    .filter(t => t.customerId === customer.id)
    .map(t => `${new Date(t.timestamp).toLocaleDateString()}: ${t.type} of R$ ${t.amount.toFixed(2)} - ${t.description}`)
    .join('\n');

  const languagePrompt = language === 'pt-BR' ? 'Responda em Português do Brasil.' : 'Respond in English.';

  const prompt = `
    Analyze the credit history of customer "${customer.name}".
    Current Balance: R$ ${customer.balance.toFixed(2)}
    History:
    ${history}

    Based on this data, provide:
    1. A risk assessment (Low, Medium, High).
    2. A suggestion on how to approach them for payment if they owe money.
    3. A summary of their payment behavior.
    
    Keep the tone professional and helpful for a small business owner.
    ${languagePrompt}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  return response.text;
};

export const getGeneralBusinessAdvice = async (totalReceivable: number, activeCustomers: number, language: Language) => {
  const ai = getAI();
  const languagePrompt = language === 'pt-BR' ? 'Responda em Português do Brasil.' : 'Respond in English.';
  
  const prompt = `
    I run a small business. 
    Currently, I have R$ ${totalReceivable.toFixed(2)} in "fiado" (credit given to customers).
    I have ${activeCustomers} active customers with outstanding balances.
    
    Give me 3 quick, actionable tips to improve my cash flow and reduce defaults.
    ${languagePrompt}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  return response.text;
};

export const extractItemsFromInvoice = async (base64DataWithHeader: string, mimeType: string) => {
  const ai = getAI();
  
  const prompt = `
    You are a specialized OCR assistant for Brazilian retail receipts (NFC-e and general receipts).
    Look closely at the provided image/document.
    
    TASK: EXTRACT EVERY INDIVIDUAL PRODUCT ITEM.
    
    CRITICAL RULES:
    1. DO NOT extract "TOTAL", "VALOR TOTAL", "VALOR A PAGAR", "SUBTOTAL".
    2. DO NOT extract taxes (ICMS, ISS, etc.).
    3. Look for the product list section. Usually starts with columns like "ITEM", "CODIGO", "DESCRICAO", "QTD", "VL UNIT", "VL TOTAL".
    4. For each product line (e.g., "PICANHA A BOU PECA VACUO kg"), return the name and the TOTAL price for that specific item line.
    5. Ensure numbers are parsed correctly as floats.
    6. Return ONLY a JSON array.
    
    Example format: [{"name": "Item Description", "price": 10.50}]
  `;

  const base64Data = base64DataWithHeader.split(',')[1] || base64DataWithHeader;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            price: { type: Type.NUMBER },
          },
          required: ["name", "price"],
        },
      },
    },
  });

  try {
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (e) {
    console.error("AI parse error:", e);
    return [];
  }
};
