export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const token  = process.env.GITHUB_TOKEN;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { slug } = body;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/docs/${slug}.html`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };

  const check = await fetch(apiUrl, { headers });
  if (!check.ok) {
    return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
  }
  const { sha } = await check.json();

  const del = await fetch(apiUrl, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ message: `docs: delete ${slug}`, sha, branch })
  });

  if (!del.ok) {
    const err = await del.text();
    return new Response(JSON.stringify({ error: 'GitHub error', detail: err }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
