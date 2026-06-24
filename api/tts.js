import { VOICES } from '../js/config.js';

const ALLOWED_VOICE_IDS = new Set(VOICES.map((v) => v.id));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ELEVENLABS_API_KEY en el servidor' });
  }

  const { text, voiceId } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Falta text' });
  }

  // Validar voiceId contra la lista blanca; si no viene o es inválido, usar el primero permitido.
  const voice = ALLOWED_VOICE_IDS.has(voiceId) ? voiceId : VOICES[0].id;

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'xi-api-key': apiKey,
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('ElevenLabs error', upstream.status, detail);
      return res.status(502).json({ error: 'Error al generar la voz' });
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio);
  } catch (err) {
    console.error('tts handler error', err);
    return res.status(502).json({ error: 'Error al generar la voz' });
  }
}
