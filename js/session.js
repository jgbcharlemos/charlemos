const PAUSE_KEY = 'charlemos_paused';

export function savePausedSession({ messages, topicKey, topicLabel, name, level, elapsedMs, slot }) {
  localStorage.setItem(PAUSE_KEY, JSON.stringify({ messages, topicKey, topicLabel, name, level, elapsedMs, slot, savedAt: Date.now() }));
}

export function loadPausedSession() {
  try {
    const raw = localStorage.getItem(PAUSE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearPausedSession() {
  localStorage.removeItem(PAUSE_KEY);
}

export async function submitReport({ messages, topicKey, name, level, durationMs, slot }) {
  try {
    await fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, topicKey, name, level, durationMs, slot }),
    });
  } catch {
    // reportes no críticos: si falla no interrumpir al usuario
  }
}
