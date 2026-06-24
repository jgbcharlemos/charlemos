export const VOICES = [
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Voz masculina cálida' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Voz masculina serena' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Voz femenina suave' },
];

export const LEVELS = [
  { key: 'alto',        label: 'Apenas empezando (mucha ayuda)' },
  { key: 'intermedio',  label: 'Va mejorando' },
  { key: 'bajo',        label: 'Habla muy bien (charla normal)' },
];

export const DEFAULT_CONFIG = {
  name: 'Dario',
  voiceId: VOICES[0].id,
  volume: 1,
  level: 'alto',
};

const STORAGE_KEY = 'charlemos_config';

export function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(partial) {
  const next = { ...getConfig(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
