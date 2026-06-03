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

  const { oldSlug, newSlug: rawNew } = body;
  if (!oldSlug || !rawNew) {
    return new Response(JSON.stringify({ error: 'Missing oldSlug or newSlug' }), { status: 400 });
  }

  const newSlug = rawNew.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  if (!newSlug) {
    return new Response(JSON.stringify({ error: 'Invalid new slug' }), { status: 400 });
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const base = `https://api.github.com/repos/${repo}/contents/docs`;

  // Fetch old file
  const getRes = await fetch(`${base}/${oldSlug}.html`, { headers });
  if (!getRes.ok) {
    return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
  }
  const { content, sha } = await getRes.json();
  const cleanContent = content.replace(/\n/g, '');

  // Create new file
  const putRes = await fetch(`${base}/${newSlug}.html`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message: `docs: rename ${oldSlug} → ${newSlug}`, content: cleanContent, branch })
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(JSON.stringify({ error: 'GitHub error on create', detail: err }), { status: 502 });
  }

  // Delete old file
  await fetch(`${base}/${oldSlug}.html`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ message: `docs: remove ${oldSlug} after rename`, sha, branch })
  });

  return new Response(JSON.stringify({ slug: newSlug, url: `/docs/${newSlug}` }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
