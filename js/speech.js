export function createRecognizer({ onResult, onNoSpeech, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    return { supported: false, start() {}, stop() {} };
  }

  const recognition = new SR();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let gotResult = false;

  recognition.onresult = (event) => {
    gotResult = true;
    const transcript = event.results[0][0].transcript.trim();
    onResult?.(transcript);
  };
  recognition.onerror = (event) => {
    gotResult = true; // evitar el doble disparo de onend
    onError?.(event.error);
  };
  recognition.onend = () => {
    if (!gotResult) onNoSpeech?.(); // silencio completo → notificar al app
    gotResult = false;
    onEnd?.();
  };

  return {
    supported: true,
    start() {
      try { recognition.start(); } catch { /* ya estaba activo */ }
    },
    stop() {
      try { recognition.stop(); } catch { /* ignore */ }
    },
  };
}
