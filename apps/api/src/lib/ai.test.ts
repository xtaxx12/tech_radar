import { describe, expect, it } from 'vitest';
import { selectProviderChain } from './ai.js';

function env(extra: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) base[key] = value;
  }
  return base;
}

describe('selectProviderChain', () => {
  it('prefers Ollama first in development when USE_OLLAMA=true', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'development',
      USE_OLLAMA: 'true',
      OPENAI_API_KEY: 'sk-test'
    }));
    expect(chain.map((entry) => entry.name)).toEqual(['ollama', 'openai']);
  });

  it('puts OpenAI first in production even if Ollama is enabled against localhost', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'production',
      USE_OLLAMA: 'true',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OPENAI_API_KEY: 'sk-prod'
    }));
    // Ollama local se omite en prod: no tiene sentido depender de una instancia
    // que vive en la máquina del desarrollador.
    expect(chain.map((entry) => entry.name)).toEqual(['openai']);
  });

  it('keeps a remote Ollama (no localhost) as last-resort fallback in production', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'production',
      OLLAMA_MODEL: 'qwen2.5:7b',
      OLLAMA_BASE_URL: 'https://ollama.midominio.com',
      OPENAI_API_KEY: 'sk-prod',
      GEMINI_API_KEY: 'gem-prod'
    }));
    expect(chain.map((entry) => entry.name)).toEqual(['openai', 'gemini', 'ollama']);
  });

  it('returns an empty chain when nothing is configured', () => {
    const chain = selectProviderChain(env({ NODE_ENV: 'production' }));
    expect(chain).toEqual([]);
  });

  it('honors AI_PROVIDER override regardless of NODE_ENV', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'production',
      AI_PROVIDER: 'ollama',
      OLLAMA_MODEL: 'qwen2.5:7b',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OPENAI_API_KEY: 'sk-prod'
    }));
    // Usuario fuerza Ollama → va primero aunque sea local en prod.
    expect(chain.map((entry) => entry.name)).toEqual(['ollama', 'openai']);
  });

  it('falls back to OpenAI/Gemini when AI_PROVIDER=openai is set but some keys missing', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'production',
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-prod',
      GEMINI_API_KEY: 'gem-prod'
    }));
    expect(chain.map((entry) => entry.name)).toEqual(['openai', 'gemini']);
  });

  it('treats host.docker.internal as "local" for the prod exclusion rule', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'production',
      USE_OLLAMA: 'true',
      OLLAMA_BASE_URL: 'http://host.docker.internal:11434',
      OPENAI_API_KEY: 'sk-prod'
    }));
    expect(chain.map((entry) => entry.name)).toEqual(['openai']);
  });

  it('in development with only OpenAI configured returns just OpenAI', () => {
    const chain = selectProviderChain(env({
      NODE_ENV: 'development',
      OPENAI_API_KEY: 'sk-dev'
    }));
    expect(chain.map((entry) => entry.name)).toEqual(['openai']);
  });
});
