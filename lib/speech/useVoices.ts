import { useEffect, useState } from 'react';
import { subscribeVoices } from './voices';

/** The browser's voice list, refreshed on `voiceschanged`. Empty until the browser reports voices. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => subscribeVoices(setVoices), []);
  return voices;
}
