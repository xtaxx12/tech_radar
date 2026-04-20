import { fetchWithTimeout } from './fetch-with-timeout.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
const AI_TIMEOUT_MS = 15_000;

type AiProvider = 'ollama' | 'openai' | 'gemini' | 'auto';

function resolveProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (raw === 'ollama' || raw === 'openai' || raw === 'gemini') return raw;
  return 'auto';
}

export async function generateText(prompt: string): Promise<string> {
  const provider = resolveProvider();
  const ollamaModel = process.env.OLLAMA_MODEL?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (provider === 'ollama') {
    return callOllama(prompt, ollamaModel || 'qwen2.5:7b');
  }

  if (provider === 'openai') {
    if (!openAiKey) {
      console.warn('[ai] AI_PROVIDER=openai pero falta OPENAI_API_KEY');
      return fallbackText(prompt);
    }
    return callOpenAI(prompt, openAiKey, process.env.OPENAI_MODEL ?? 'gpt-4o-mini');
  }

  if (provider === 'gemini') {
    if (!geminiKey) {
      console.warn('[ai] AI_PROVIDER=gemini pero falta GEMINI_API_KEY');
      return fallbackText(prompt);
    }
    return callGemini(prompt, geminiKey, process.env.GEMINI_MODEL ?? 'gemini-1.5-flash');
  }

  // Auto: detecta el primero que esté configurado. Mantiene compat con
  // setups previos que solo definían USE_OLLAMA / OPENAI_API_KEY / GEMINI_API_KEY.
  if (ollamaModel || process.env.USE_OLLAMA === 'true') {
    return callOllama(prompt, ollamaModel || 'qwen2.5:7b');
  }
  if (openAiKey) {
    return callOpenAI(prompt, openAiKey, process.env.OPENAI_MODEL ?? 'gpt-4o-mini');
  }
  if (geminiKey) {
    return callGemini(prompt, geminiKey, process.env.GEMINI_MODEL ?? 'gemini-1.5-flash');
  }
  return fallbackText(prompt);
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Eres un asistente de eventos tecnológicos en Latinoamérica. Responde en español claro y breve.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    }, AI_TIMEOUT_MS);

    if (!response.ok) {
      return fallbackText(prompt);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || fallbackText(prompt);
  } catch (error) {
    console.warn('[ai] openai error:', error instanceof Error ? error.message : error);
    return fallbackText(prompt);
  }
}

async function callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(`${GEMINI_URL}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.3
        }
      })
    }, AI_TIMEOUT_MS);

    if (!response.ok) {
      return fallbackText(prompt);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallbackText(prompt);
  } catch (error) {
    console.warn('[ai] gemini error:', error instanceof Error ? error.message : error);
    return fallbackText(prompt);
  }
}

async function callOllama(prompt: string, model: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2
        }
      })
    }, AI_TIMEOUT_MS);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`[ai] ollama ${response.status} for model="${model}": ${body.slice(0, 200)}`);
      return fallbackText(prompt);
    }

    const data = await response.json() as { response?: string };
    return data.response?.trim() || fallbackText(prompt);
  } catch (error) {
    console.warn('[ai] ollama error:', error instanceof Error ? error.message : error);
    return fallbackText(prompt);
  }
}

function fallbackText(prompt: string): string {
  const firstLine = prompt.split('\n').find(Boolean)?.trim() ?? 'evento tech';
  return `Resumen automático: ${firstLine}. Recomendado por coincidencia temática, cercanía temporal y nivel del perfil.`;
}
