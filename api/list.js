export const config = { runtime: 'edge' };

export default async function handler(req) {
  const token  = process.env.GITHUB_TOKEN;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repo) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const url = `https://api.github.com/repos/${repo}/contents/docs?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  });

  if (res.status === 404) {
    return new Response(JSON.stringify({ files: [] }), { status: 200 });
  }

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'GitHub error' }), { status: 502 });
  }

  const items = await res.json();
  const files = items
    .filter(f => f.name.endsWith('.html'))
    .map(f => ({
      slug: f.name.replace(/\.html$/, ''),
      name: f.name.replace(/\.html$/, '').replace(/-/g, ' '),
      url: `/${f.name.replace(/\.html$/, '')}`,
      sha: f.sha
    }));

  return new Response(JSON.stringify({ files }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
