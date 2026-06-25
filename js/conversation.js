function getDeviceId() {
  return localStorage.getItem('charlemos_device_id') || '';
}

export function createConversation(name, topic, level, initialMessages = []) {
  const messages = [...initialMessages];

  async function request() {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': getDeviceId(),
      },
      body: JSON.stringify({ messages, name, topic, level }),
    });
    if (res.status === 403) {
      const err = new Error('DEVICE_NOT_AUTHORIZED');
      err.code = 403;
      throw err;
    }
    if (!res.ok) throw new Error('No se pudo obtener respuesta');
    const data = await res.json();
    const reply = (data.reply || '').trim();
    messages.push({ role: 'assistant', content: reply });
    return reply;
  }

  return {
    async start() {
      messages.push({ role: 'user', content: '(El usuario abrió la conversación. Salúdalo con calidez, dile que van a charlar un buen rato, y haz tu primera pregunta.)' });
      return request();
    },
    async send(userText) {
      messages.push({ role: 'user', content: userText });
      return request();
    },
    getMessages() { return [...messages]; },
  };
}
