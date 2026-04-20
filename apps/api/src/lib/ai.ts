import { fetchWithTimeout } from './fetch-with-timeout.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const AI_TIMEOUT_MS = 15_000;

const LOCAL_HOST_PATTERN = /(localhost|127\.0\.0\.1|host\.docker\.internal|0\.0\.0\.0)/i;

export type AiProvider = 'ollama' | 'openai' | 'gemini';
type ProviderCall = (prompt: string) => Promise<string>;
type ProviderEntry = { name: AiProvider; run: ProviderCall };

/**
 * Devuelve la cadena de providers a intentar, en orden. El primero que
 * responda sin lanzar gana; si todos fallan, el caller usa fallbackText.
 *
 * Regla principal pedida por el usuario:
 *   - En desarrollo local (NODE_ENV !== 'production') preferimos Ollama si
 *     está habilitado y apunta a un host local (es gratis y privado).
 *   - En producción preferimos OpenAI → Gemini. Ollama queda al final solo
 *     si apunta a un endpoint remoto explícito (así quien tenga un Ollama
 *     self-hosted público lo puede usar).
 *
 * Si el usuario fuerza AI_PROVIDER=<algo>, esa elección gana y el resto
 * queda como fallback en el orden estándar.
 */
export function selectProviderChain(env: NodeJS.ProcessEnv = process.env): ProviderEntry[] {
  const ollama = buildOllamaEntry(env);
  const openai = buildOpenAiEntry(env);
  const gemini = buildGeminiEntry(env);

  const forced = (env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (forced === 'ollama' || forced === 'openai' || forced === 'gemini') {
    const byName: Record<AiProvider, ProviderEntry | null> = {
      ollama,
      openai,
      gemini
    };
    const first = byName[forced as AiProvider];
    const rest = (Object.keys(byName) as AiProvider[])
      .filter((name) => name !== forced)
      .map((name) => byName[name])
      .filter((entry): entry is ProviderEntry => entry !== null);
    return first ? [first, ...rest] : rest;
  }

  const isProd = (env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  const ollamaUrl = env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
  const ollamaIsLocal = LOCAL_HOST_PATTERN.test(ollamaUrl);

  const entries: (ProviderEntry | null)[] = isProd
    ? [openai, gemini, ollamaIsLocal ? null : ollama]
    : [ollama, openai, gemini];

  return entries.filter((entry): entry is ProviderEntry => entry !== null);
}

export async function generateText(prompt: string): Promise<string> {
  const chain = selectProviderChain();

  for (const provider of chain) {
    try {
      const text = await provider.run(prompt);
      const trimmed = text.trim();
      if (trimmed.length > 0) return trimmed;
      console.warn(`[ai] provider ${provider.name} devolvió texto vacío, probando el siguiente`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[ai] provider ${provider.name} falló: ${message}`);
    }
  }

  return fallbackText(prompt);
}

function buildOllamaEntry(env: NodeJS.ProcessEnv): ProviderEntry | null {
  const model = env.OLLAMA_MODEL?.trim();
  const explicit = env.USE_OLLAMA === 'true';
  if (!model && !explicit) return null;

  const baseUrl = env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434';
  return {
    name: 'ollama',
    run: (prompt) => callOllama(prompt, baseUrl, model || 'qwen2.5:7b')
  };
}

function buildOpenAiEntry(env: NodeJS.ProcessEnv): ProviderEntry | null {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const model = env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  return {
    name: 'openai',
    run: (prompt) => callOpenAI(prompt, key, model)
  };
}

function buildGeminiEntry(env: NodeJS.ProcessEnv): ProviderEntry | null {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const model = env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
  return {
    name: 'gemini',
    run: (prompt) => callGemini(prompt, key, model)
  };
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
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
    const body = await response.text().catch(() => '');
    throw new Error(`openai ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('openai empty response');
  return content;
}

async function callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
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
    const body = await response.text().catch(() => '');
    throw new Error(`gemini ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error('gemini empty response');
  return content;
}

async function callOllama(prompt: string, baseUrl: string, model: string): Promise<string> {
  const response = await fetchWithTimeout(`${baseUrl}/api/generate`, {
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
    throw new Error(`ollama ${response.status} model="${model}": ${body.slice(0, 200)}`);
  }

  const data = await response.json() as { response?: string };
  const content = data.response?.trim();
  if (!content) throw new Error('ollama empty response');
  return content;
}

function fallbackText(prompt: string): string {
  const firstLine = prompt.split('\n').find(Boolean)?.trim() ?? 'evento tech';
  return `Resumen automático: ${firstLine}. Recomendado por coincidencia temática, cercanía temporal y nivel del perfil.`;
}
