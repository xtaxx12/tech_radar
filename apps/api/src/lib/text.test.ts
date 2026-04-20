import { describe, expect, it } from 'vitest';
import { normalizeText, uniqueStrings } from './text.js';

describe('normalizeText', () => {
  it('lowercases and trims', () => {
    expect(normalizeText('  Ecuador  ')).toBe('ecuador');
  });

  it('strips diacritics', () => {
    expect(normalizeText('México')).toBe('mexico');
    expect(normalizeText('Panamá')).toBe('panama');
    expect(normalizeText('Perú')).toBe('peru');
    expect(normalizeText('São Paulo')).toBe('sao paulo');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeText('   ')).toBe('');
  });
});

describe('uniqueStrings', () => {
  it('removes duplicates after normalization', () => {
    expect(uniqueStrings(['IA', 'ia', 'Ia  '])).toEqual(['ia']);
  });

  it('preserves first-seen order', () => {
    expect(uniqueStrings(['Web', 'Mobile', 'web', 'Cloud'])).toEqual(['web', 'mobile', 'cloud']);
  });

  it('drops empty / whitespace-only entries', () => {
    expect(uniqueStrings(['ia', '', '   ', 'web'])).toEqual(['ia', 'web']);
  });
});
