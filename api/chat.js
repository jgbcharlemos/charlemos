import { buildSystemPrompt } from '../js/prompts.js';

const MAX_TOKENS = { alto: 100, intermedio: 200, bajo: 400 };

const SEARCH_TOOL = {
  name: 'web_search',
  description: 'Busca información reciente en internet cuando no tengas la respuesta. Úsala solo para hechos actuales: resultados de partidos, noticias recientes, precios actuales, eventos en curso.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Consulta de búsqueda en español' },
    },
    required: ['query'],
  },
};

async function runSearch(query) {
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const res = await fetch(`${base}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return 'No encontré información actualizada sobre eso.';
    const { results } = await res.json();
    if (!results || results.length === 0) return 'No encontré información actualizada sobre eso.';
    return results.map(r => `${r.title}: ${r.description}`).join('\n\n');
  } catch {
    return 'No pude buscar esa información ahora.';
  }
}

async function validateDevice(req) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return true; // sin Redis configurado, no bloquear
  const deviceId = req.headers['x-device-id'];
  if (!deviceId) return false;
  try {
    const r = await fetch(`${kvUrl}/get/charlemos_active_device`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    const data = await r.json();
    const current = data.result ? JSON.parse(data.result) : null;
    return current && current.deviceId === deviceId;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const authorized = await validateDevice(req);
  if (!authorized) return res.status(403).json({ error: 'Dispositivo no autorizado' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY' });

  const { messages, name, topic, level } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Falta messages' });
  }

  const system = buildSystemPrompt(name || 'Dario', topic || 'general', level || 'alto');
  const recent = messages.slice(-20);
  const maxTokens = MAX_TOKENS[level] || 100;
  const hasBrave = !!process.env.BRAVE_SEARCH_API_KEY;

  try {
    const body = {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: recent,
      ...(hasBrave ? { tools: [SEARCH_TOOL] } : {}),
    };

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error('Anthropic error', anthropicRes.status, detail);
      return res.status(502).json({ error: 'Error al obtener respuesta' });
    }

    const data = await anthropicRes.json();

    if (data.stop_reason === 'tool_use') {
      const toolUse = data.content.find(b => b.type === 'tool_use');
      if (toolUse && toolUse.name === 'web_search') {
        const searchResults = await runSearch(toolUse.input.query);

        const messagesWithTool = [
          ...recent,
          { role: 'assistant', content: data.content },
          {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: searchResults,
            }],
          },
        ];

        const body2 = {
          model: 'claude-sonnet-4-6',
          max_tokens: MAX_TOKENS.bajo,
          system,
          messages: messagesWithTool,
          ...(hasBrave ? { tools: [SEARCH_TOOL] } : {}),
        };

        const res2 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body2),
        });

        if (!res2.ok) {
          const detail2 = await res2.text();
          console.error('Anthropic error (2da llamada)', res2.status, detail2);
          return res.status(502).json({ error: 'Error al obtener respuesta con búsqueda' });
        }

        const data2 = await res2.json();
        const textBlock2 = data2.content.find(b => b.type === 'text');
        const reply2 = textBlock2 ? textBlock2.text.trim() : '';
        return res.status(200).json({ reply: reply2 });
      }
    }

    const textBlock = data.content.find(b => b.type === 'text');
    const reply = textBlock ? textBlock.text.trim() : '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('chat handler error', err);
    return res.status(502).json({ error: 'Error interno' });
  }
}
