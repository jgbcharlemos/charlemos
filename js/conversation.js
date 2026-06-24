export function createConversation(name, topic, level) {
  const messages = [];
  let exchanges = 0;

  async function request() {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, name, topic, level }),
    });
    if (!res.ok) throw new Error('No se pudo obtener respuesta');
    const data = await res.json();
    const reply = (data.reply || '').trim();
    messages.push({ role: 'assistant', content: reply });
    return reply;
  }

  return {
    async start() {
      messages.push({ role: 'user', content: '(El usuario abrió la conversación. Salúdalo y haz tu primera pregunta.)' });
      return request();
    },
    async send(userText) {
      messages.push({ role: 'user', content: userText });
      exchanges += 1;
      return request();
    },
    shouldWrapUp() {
      return exchanges >= 5;
    },
  };
}
