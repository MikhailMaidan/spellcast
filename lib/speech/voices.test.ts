import { describe, expect, it } from 'vitest';
import { compareVoices, normaliseLang, resolveVoice, voiceLabel, voiceQuality } from './voices';

function fake(name: string, lang: string, localService: boolean, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, localService, default: isDefault, voiceURI: name } as SpeechSynthesisVoice;
}

describe('voiceQuality', () => {
  it('ranks neural voices first, robotic SAPI voices last', () => {
    expect(voiceQuality(fake('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', false))).toBe('natural');
    expect(voiceQuality(fake('Google UK English Female', 'en-GB', false))).toBe('good');
    expect(voiceQuality(fake('Microsoft Hazel Desktop - English (Great Britain)', 'en-GB', true))).toBe('legacy');
    expect(voiceQuality(fake('Microsoft David - English (United States)', 'en-US', true))).toBe('legacy');
    expect(voiceQuality(fake('Samantha', 'en-US', true))).toBe('good');
    expect(voiceQuality(fake('Daniel (Enhanced)', 'en-GB', true))).toBe('natural');
  });

  it('labels quality and network', () => {
    expect(voiceLabel(fake('Google UK English Male', 'en-GB', false))).toBe('Google UK English Male · good, network');
    expect(voiceLabel(fake('Microsoft Hazel Desktop', 'en-GB', true))).toBe('Microsoft Hazel Desktop · legacy, robotic');
  });
});

describe('compareVoices / resolveVoice', () => {
  const voices = [
    fake('Microsoft Hazel Desktop - English (Great Britain)', 'en-GB', true),
    fake('Google UK English Female', 'en-GB', false),
    fake('Microsoft David Desktop - English (United States)', 'en-US', true, true),
    fake('Google Deutsch', 'de-DE', false),
    fake('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', false),
  ].sort(compareVoices);

  it('sorts English first, then locale, then quality', () => {
    expect(voices.map((v) => v.name)).toEqual([
      'Microsoft Sonia Online (Natural) - English (United Kingdom)',
      'Google UK English Female',
      'Microsoft Hazel Desktop - English (Great Britain)',
      'Microsoft David Desktop - English (United States)',
      'Google Deutsch',
    ]);
  });

  it('picks the best voice of the locale by default and falls back in order', () => {
    expect(resolveVoice(voices, { voiceURI: null, locale: 'en-GB' })).toMatchObject({ level: 'locale', voice: { name: 'Microsoft Sonia Online (Natural) - English (United Kingdom)' } });
    expect(resolveVoice(voices, { voiceURI: 'Google UK English Female', locale: 'en-GB' }).level).toBe('exact');
    expect(resolveVoice(voices, { voiceURI: 'missing', locale: 'en-AU' })).toMatchObject({ level: 'english', voice: { lang: 'en-GB' } });
    expect(resolveVoice([], { voiceURI: null, locale: 'any' }).level).toBe('none');
  });

  it('normalises language tags', () => {
    expect(normaliseLang('en_gb')).toBe('en-GB');
    expect(normaliseLang('EN-us')).toBe('en-US');
    expect(normaliseLang('')).toBe('');
  });
});
