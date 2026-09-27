import { describe, expect, it } from 'vitest';
import { detectLanguage } from '../i18n';

describe('detectLanguage', () => {
  it('defaults to pt-BR when no preference is stored', () => {
    // Given no stored language preference
    // When resolving the app language
    // Then it opens in Portuguese
    expect(detectLanguage(null)).toBe('pt-BR');
  });

  it('honours a stored preference', () => {
    // Given the user previously chose English
    // When resolving the app language
    // Then English is used
    expect(detectLanguage('en-US')).toBe('en-US');
  });
});
