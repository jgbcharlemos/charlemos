export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const appPin = process.env.APP_PIN;

  if (!kvUrl || !kvToken || !appPin) {
    return res.status(500).json({ error: 'Configuración incompleta' });
  }

  const { pin, deviceId } = req.body || {};
  if (!pin || !deviceId) return res.status(400).json({ error: 'Faltan datos' });

  if (pin !== appPin) return res.status(401).json({ error: 'PIN incorrecto' });

  try {
    const r = await fetch(`${kvUrl}/get/charlemos_active_device`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    const data = await r.json();
    const current = data.result ? JSON.parse(data.result) : null;

    if (current && current.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Ya hay un dispositivo activo. Pídele a Juan que libere el acceso.' });
    }

    if (!current) {
      const record = { deviceId, registeredAt: new Date().toISOString() };
      await fetch(`${kvUrl}/set/charlemos_active_device`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(record),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('activate error', err);
    return res.status(502).json({ error: 'Error interno' });
  }
}
