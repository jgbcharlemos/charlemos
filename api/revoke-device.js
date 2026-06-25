export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!kvUrl || !kvToken || !adminPassword) {
    return res.status(500).json({ error: 'Configuración incompleta' });
  }

  const authHeader = req.headers['x-admin-password'];
  if (authHeader !== adminPassword) return res.status(401).json({ error: 'No autorizado' });

  try {
    await fetch(`${kvUrl}/del/charlemos:active_device`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('revoke-device error', err);
    return res.status(502).json({ error: 'Error interno' });
  }
}
