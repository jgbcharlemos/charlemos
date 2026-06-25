export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!kvUrl || !kvToken || !adminPassword) {
    return res.status(500).json({ error: 'Configuración incompleta' });
  }

  const authHeader = req.headers['x-admin-password'];
  if (authHeader !== adminPassword) return res.status(401).json({ error: 'No autorizado' });

  try {
    const r = await fetch(`${kvUrl}/get/charlemos:active_device`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    const data = await r.json();
    const current = data.result ? JSON.parse(data.result) : null;
    if (current) {
      return res.status(200).json({ active: true, registeredAt: current.registeredAt });
    }
    return res.status(200).json({ active: false });
  } catch (err) {
    console.error('device-status error', err);
    return res.status(502).json({ error: 'Error interno' });
  }
}
