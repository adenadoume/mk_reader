export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO;   // e.g. "adenadoume/mk_reader"
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { filename, html, title } = body;
  if (!filename || !html) {
    return new Response(JSON.stringify({ error: 'Missing filename or html' }), { status: 400 });
  }

  // Sanitise slug: lowercase, only alphanum + dash
  const slug = filename
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-').slice(0, 3).join('-')
    .slice(0, 30);

  const path = `docs/${slug}.html`;
  const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`;

  // Check if file exists (need its SHA to update)
  let sha;
  const check = await fetch(apiBase, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });
  if (check.ok) {
    const data = await check.json();
    sha = data.sha;
  }

  const content = btoa(unescape(encodeURIComponent(html)));

  const payload = {
    message: `docs: save ${slug}`,
    content,
    branch,
    ...(sha ? { sha } : {})
  };

  const put = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!put.ok) {
    const err = await put.text();
    return new Response(JSON.stringify({ error: 'GitHub error', detail: err }), { status: 502 });
  }

  return new Response(JSON.stringify({ slug, url: `/${slug}` }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
