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
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return 'No encontré información actualizada sobre eso.';
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3&search_lang=es&country=co`;
    const upstream = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });
    if (!upstream.ok) {
      console.error('Brave error', upstream.status, await upstream.text());
      return 'No encontré información actualizada sobre eso.';
    }
    const data = await upstream.json();
    const results = (data.web?.results || []).slice(0, 3);
    if (results.length === 0) return 'No encontré información actualizada sobre eso.';
    return results.map(r => `${r.title}: ${r.description}`).join('\n\n');
  } catch (err) {
    console.error('runSearch error', err);
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
      // Damos espacio suficiente para que Claude pueda generar una búsqueda si la necesita;
      // la respuesta final al usuario se mantiene breve por instrucción del prompt.
      max_tokens: hasBrave ? Math.max(maxTokens, 300) : maxTokens,
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
        console.log('Búsqueda:', toolUse.input.query, '→', searchResults.slice(0, 200));

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
          // Sin tools en la segunda llamada: forzamos respuesta de texto
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
        const textBlock2 = (data2.content || []).find(b => b.type === 'text');
        let reply2 = textBlock2 ? textBlock2.text.trim() : '';
        if (!reply2) {
          console.error('2da llamada sin texto. stop_reason:', data2.stop_reason,
            'content:', JSON.stringify(data2.content));
          // Fallback: dar el dato directo desde los resultados de búsqueda
          reply2 = `Mira, encontré esto: ${searchResults.split('\n')[0]}. ¿Y a usted qué le parece?`;
        }
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
