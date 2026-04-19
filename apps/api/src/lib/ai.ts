const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function generateText(prompt: string): Promise<string> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (openAiKey) {
    return callOpenAI(prompt, openAiKey, process.env.OPENAI_MODEL ?? 'gpt-4o-mini');
  }

  if (geminiKey) {
    return callGemini(prompt, geminiKey, process.env.GEMINI_MODEL ?? 'gemini-1.5-flash');
  }

  return fallbackText(prompt);
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch(OPENAI_URL, {
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
  });

  if (!response.ok) {
    return fallbackText(prompt);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || fallbackText(prompt);
}

async function callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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
  });

  if (!response.ok) {
    return fallbackText(prompt);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallbackText(prompt);
}

function fallbackText(prompt: string): string {
  const firstLine = prompt.split('\n').find(Boolean)?.trim() ?? 'evento tech';
  return `Resumen automático: ${firstLine}. Recomendado por coincidencia temática, cercanía temporal y nivel del perfil.`;
}
