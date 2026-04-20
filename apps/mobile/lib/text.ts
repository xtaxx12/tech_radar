// Acrónimos comunes que queremos preservar al des-gritar títulos.
const ACRONYMS = new Set([
  'AI', 'ML', 'LLM', 'UX', 'UI', 'API', 'SDK', 'HTTP', 'HTTPS', 'SQL',
  'CSS', 'HTML', 'JS', 'TS', 'PHP', 'IoT', 'AR', 'VR', 'XR',
  'AWS', 'GCP', 'DSA', 'CTO', 'CEO', 'PM', 'PR', 'QA', 'CI', 'CD',
  'GDG', 'USFQ', 'UTPL', 'ESPOL', 'PUCE', 'EPN'
]);

// Palabras cortas en español/inglés que deberían ir en minúsculas si la
// frase está en sentence case (no las primeras).
const LOWERCASE_STOPWORDS = new Set([
  'de', 'del', 'el', 'la', 'las', 'los', 'en', 'a', 'al', 'y', 'o',
  'u', 'con', 'para', 'por', 'sin', 'se', 'un', 'una', 'unos', 'unas',
  'que', 'como', 'es',
  'of', 'the', 'and', 'or', 'to', 'in', 'at', 'on', 'for', 'by', 'with', 'is'
]);

/**
 * Si un string viene mayormente en MAYÚSCULAS (típico de GDG/Meetup),
 * lo convierte a sentence case preservando acrónimos comunes. Si ya viene
 * en mixed case, lo devuelve tal cual para no pisar la intención del autor.
 */
export function deshout(input: string): string {
  if (!input) return input;
  const letters = input.match(/[A-Za-zÀ-ÿ]/g);
  if (!letters || letters.length < 6) return input;

  const upperCount = input.match(/[A-ZÀ-Ý]/g)?.length ?? 0;
  const ratio = upperCount / letters.length;
  if (ratio < 0.6) return input; // ya está en mixed case

  return input
    .split(/(\s+)/)
    .map((token, index) => {
      if (/^\s+$/.test(token)) return token;
      const stripped = token.replace(/[^A-Za-zÀ-ÿ]/g, '');
      if (!stripped) return token;
      if (ACRONYMS.has(stripped.toUpperCase())) {
        return token.replace(stripped, stripped.toUpperCase());
      }
      const lower = token.toLowerCase();
      const firstLetterMatch = /[a-zà-ÿ]/i.exec(lower);
      if (!firstLetterMatch) return lower;
      const isFirstWord = index === 0;
      if (!isFirstWord && LOWERCASE_STOPWORDS.has(stripped.toLowerCase())) {
        return lower;
      }
      const idx = firstLetterMatch.index;
      return lower.slice(0, idx) + lower.charAt(idx).toUpperCase() + lower.slice(idx + 1);
    })
    .join('');
}
