export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!anthropicKey || !kvUrl || !kvToken) {
    console.error('Faltan variables de entorno para reportes');
    return res.status(500).json({ error: 'Configuración incompleta' });
  }

  const { messages, topicKey, name, level, durationMs, slot } = req.body || {};
  if (!messages || messages.length < 2) return res.status(400).json({ error: 'Conversación muy corta para generar reporte' });

  const durationMin = Math.round(durationMs / 60000);
  const transcript = messages
    .filter(m => typeof m.content === 'string' && !m.content.startsWith('(El usuario'))
    .map(m => `${m.role === 'assistant' ? 'IA' : 'Dario'}: ${m.content}`)
    .join('\n');

  const analysisPrompt = `Eres un terapeuta del lenguaje analizando la recuperación del habla de un adulto mayor de 80 años post-ACV llamado ${name || 'Dario'}.

Analiza esta conversación de ${durationMin} minutos sobre el tema "${topicKey}" y genera un reporte JSON con exactamente esta estructura:

{
  "fluency": "descripción breve de la fluidez observada (1-2 frases)",
  "response_length": "descripción de la extensión de las respuestas (1-2 frases)",
  "engagement": "descripción del nivel de participación e interés (1-2 frases)",
  "progress_note": "nota clínica sobre tendencia (compara con lo que es esperable en este nivel: ${level})",
  "recommendation": "una sugerencia concreta para la próxima sesión"
}

Responde SOLO con el JSON, sin texto adicional.

TRANSCRIPCIÓN:
${transcript.slice(0, 3000)}`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: analysisPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      console.error('Error generando reporte', await anthropicRes.text());
      return res.status(502).json({ error: 'Error generando análisis' });
    }

    const aiData = await anthropicRes.json();
    const textBlock = aiData.content.find(b => b.type === 'text');
    let analysis = {};
    try { analysis = JSON.parse(textBlock?.text || '{}'); } catch { analysis = { raw: textBlock?.text }; }

    const sessionId = `session_${Date.now()}`;
    const now = new Date();
    const record = {
      id: sessionId,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      slot,
      topicKey,
      name: name || 'Dario',
      level,
      durationMin,
      analysis,
    };

    await fetch(`${kvUrl}/set/${sessionId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(record),
    });

    const idxRes = await fetch(`${kvUrl}/get/sessions_index`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    const idxData = await idxRes.json();
    const index = idxData.result ? JSON.parse(idxData.result) : [];
    index.unshift(sessionId);
    const trimmed = index.slice(0, 200);
    await fetch(`${kvUrl}/set/sessions_index`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(trimmed),
    });

    return res.status(200).json({ ok: true, sessionId });
  } catch (err) {
    console.error('report handler error', err);
    return res.status(502).json({ error: 'Error interno' });
  }
}
