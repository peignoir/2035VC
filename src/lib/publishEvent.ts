import type { ShareableEvent } from '../types';
import { getRecordingBlob } from './db';

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

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function pushFile(
  owner: string, repo: string, path: string,
  content: string, message: string, headers: Record<string, string>,
): Promise<void> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // Check if file already exists (need SHA for updates)
  let sha: string | undefined;
  try {
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
      sha = (await existing.json()).sha;
    }
  } catch { /* file doesn't exist yet */ }

  const resp = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message, content, ...(sha && { sha }) }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 401 || resp.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      alert('GitHub token is invalid or lacks permissions. It has been cleared — try again.');
    }
    throw new Error(`Push failed for ${path}: ${resp.status} ${body}`);
  }
}

/** Publish event JSON and recordings to the repo. */
export async function publishEvent(
  slug: string,
  event: ShareableEvent,
  presentationIds?: string[],
): Promise<void> {
  const token = getToken();
  if (!token) return;

  const { owner, repo } = getRepoInfo();
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
  };

  // Publish recordings as separate files
  if (presentationIds) {
    for (let i = 0; i < presentationIds.length; i++) {
      const blob = await getRecordingBlob(presentationIds[i]);
      if (!blob) continue;
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const recPath = `public/events/${slug}-${i}.${ext}`;
      try {
        console.log(`[Publish] Uploading recording ${i} (${(blob.size / 1024 / 1024).toFixed(1)}MB ${blob.type})`);
        const recContent = await blobToBase64(blob);
        await pushFile(owner, repo, recPath, recContent, `Publish recording: ${slug} #${i}`, headers);
        // Only set URL after successful push
        event.presentations[i].recording = `${import.meta.env.BASE_URL}events/${slug}-${i}.${ext}`;
        console.log(`[Publish] Recording ${i} uploaded successfully`);
      } catch (e) {
        console.error('[Publish] Failed to upload recording', i, e);
      }
    }
  }

  // Publish event JSON (after recording URLs are set)
  const jsonContent = btoa(unescape(encodeURIComponent(JSON.stringify(event, null, 2))));
  await pushFile(owner, repo, `public/events/${slug}.json`, jsonContent, `Publish event: ${slug}`, headers);
}
