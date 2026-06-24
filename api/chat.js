import { buildSystemPrompt } from '../js/prompts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor' });
  }

  const { messages, name, topic, level } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Faltan messages' });
  }

  const system = buildSystemPrompt(
    typeof name === 'string' ? name : 'Dario',
    typeof topic === 'string' ? topic : '',
    typeof level === 'string' ? level : 'alto'
  );

  // Truncar a los últimos 20 mensajes para evitar contexto excesivo.
  const trimmed = messages.slice(-20);

  // max_tokens adaptado al nivel: alto = 100 tokens (respuestas cortas para el usuario), bajo = 400.
  const maxTokens = level === 'bajo' ? 400 : level === 'intermedio' ? 200 : 100;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system,
        messages: trimmed,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('Anthropic error', upstream.status, detail);
      return res.status(502).json({ error: 'Error al hablar con la IA' });
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('chat handler error', err);
    return res.status(502).json({ error: 'Error al hablar con la IA' });
  }
}
