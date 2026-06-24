let currentAudio = null;

export async function speak(text, voiceId, volume = 1) {
  stopSpeaking();
  if (!text || !text.trim()) return;

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });
  if (!res.ok) throw new Error('No se pudo generar la voz');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = Math.max(0, Math.min(1, volume));
    const cleanup = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.play().catch(cleanup);
  });
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
