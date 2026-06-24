export function createRecognizer({ onResult, onError, onEnd }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    return { supported: false, start() {}, stop() {} };
  }

  const recognition = new SR();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    onResult?.(transcript);
  };
  recognition.onerror = (event) => onError?.(event.error);
  recognition.onend = () => onEnd?.();

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
