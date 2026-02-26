import type { ShareableEvent } from '../types';

const TOKEN_KEY = 'github_token';

function getRepoInfo(): { owner: string; repo: string } {
  const owner = window.location.hostname.split('.')[0];
  const repo = import.meta.env.BASE_URL.replace(/\//g, '');
  return { owner, repo };
}

function getToken(): string | null {
  let token = localStorage.getItem(TOKEN_KEY);
  if (token) return token;
  token = window.prompt('Enter a GitHub token with Contents write access to publish this event:');
  if (token) {
    localStorage.setItem(TOKEN_KEY, token.trim());
    return token.trim();
  }
  return null;
}

/** Push event JSON to the repo so clean URLs work cross-device. */
export async function publishEvent(slug: string, event: ShareableEvent): Promise<void> {
  const token = getToken();
  if (!token) return;

  const { owner, repo } = getRepoInfo();
  const path = `public/events/${slug}.json`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
  };

  // Check if file already exists (need SHA for updates)
  let sha: string | undefined;
  try {
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
      sha = (await existing.json()).sha;
    }
  } catch { /* file doesn't exist yet, that's fine */ }

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(event, null, 2))));

  const resp = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Publish event: ${slug}`,
      content,
      ...(sha && { sha }),
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      alert('GitHub token is invalid or lacks permissions. It has been cleared — try again.');
    } else {
      alert(`Failed to publish event: ${resp.status} ${body}`);
    }
    throw new Error(`Publish failed: ${resp.status}`);
  }
}
