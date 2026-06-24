export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta BRAVE_SEARCH_API_KEY' });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: 'Falta query' });

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
      const txt = await upstream.text();
      console.error('Brave error', upstream.status, txt);
      return res.status(502).json({ error: 'Error en búsqueda', results: [] });
    }
    const data = await upstream.json();
    const results = (data.web?.results || []).slice(0, 3).map(r => ({
      title: r.title,
      description: r.description,
      url: r.url,
    }));
    return res.status(200).json({ results });
  } catch (err) {
    console.error('search handler error', err);
    return res.status(502).json({ error: 'Error en búsqueda', results: [] });
  }
}
