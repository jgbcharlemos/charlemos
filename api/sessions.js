export default async function handler(req, res) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!kvUrl || !kvToken || !adminPassword) {
    return res.status(500).json({ error: 'Configuración incompleta' });
  }

  const authHeader = req.headers['x-admin-password'];
  if (authHeader !== adminPassword) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (req.method === 'GET') {
    try {
      const idxRes = await fetch(`${kvUrl}/get/sessions_index`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      const idxData = await idxRes.json();
      const index = idxData.result ? JSON.parse(idxData.result) : [];

      const sessions = await Promise.all(
        index.slice(0, 50).map(async (id) => {
          const r = await fetch(`${kvUrl}/get/${id}`, {
            headers: { Authorization: `Bearer ${kvToken}` },
          });
          const d = await r.json();
          return d.result ? JSON.parse(d.result) : null;
        })
      );

      return res.status(200).json({ sessions: sessions.filter(Boolean) });
    } catch (err) {
      console.error('sessions GET error', err);
      return res.status(502).json({ error: 'Error obteniendo sesiones' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
