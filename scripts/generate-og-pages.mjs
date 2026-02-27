/**
 * Post-build script: generates per-event HTML pages with OG meta tags.
 *
 * For each event JSON in dist/events/{city}/{date}.json, creates
 * dist/events/{city}/{date}/index.html with event-specific OG tags
 * and a redirect to the SPA hash URL.
 *
 * This allows social media crawlers (which don't execute JS) to see
 * event-specific titles, descriptions, and video previews.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const DIST = join(dirname(new URL(import.meta.url).pathname), '..', 'dist');
const BASE_URL = '/2035VC/';
const ORIGIN = 'https://peignoir.github.io';
const SITE_URL = `${ORIGIN}${BASE_URL.replace(/\/$/, '')}`;

async function findEventJsonFiles(dir) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await findEventJsonFiles(fullPath));
      } else if (entry.name.endsWith('.json') && !entry.name.includes('-logo.')) {
        files.push(fullPath);
      }
    }
  } catch { /* directory may not exist */ }
  return files;
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const eventsDir = join(DIST, 'events');
  const jsonFiles = await findEventJsonFiles(eventsDir);

  if (jsonFiles.length === 0) {
    console.log('[OG] No event JSON files found in dist/events/');
    return;
  }

  let generated = 0;

  for (const jsonPath of jsonFiles) {
    try {
      const raw = await readFile(jsonPath, 'utf-8');
      const event = JSON.parse(raw);

      // Derive slug from file path: dist/events/tallinn/2026-02-27.json → tallinn/2026-02-27
      const relative = jsonPath.slice(eventsDir.length + 1); // tallinn/2026-02-27.json
      const slug = relative.replace(/\.json$/, '');

      const title = escapeHtml(event.name || `Cafe2035 ${event.city || ''}`);
      const date = formatDate(event.date);
      const city = event.city || '';
      const description = escapeHtml(
        `Stories from the future — ${date} in ${city}. ` +
        `${event.presentations?.length || 0} speakers, 5 minutes each.`
      );

      // Find recording for video card
      // Recording URLs in JSON already include the base path (e.g. /2035VC/events/...)
      const recording = event.presentations?.find(p => p.recording)?.recording;
      const videoUrl = recording ? `${ORIGIN}${recording.startsWith('/') ? '' : '/'}${recording}` : null;

      // Logo URL for og:image (also already includes base path)
      const logoUrl = event.logo && !event.logo.startsWith('data:')
        ? `${ORIGIN}${event.logo.startsWith('/') ? '' : '/'}${event.logo}`
        : null;

      const canonicalUrl = `${SITE_URL}/events/${slug}/`;
      const hashUrl = `${SITE_URL}/#/${slug}`;

      let videoTags = '';
      if (videoUrl) {
        videoTags = `
    <meta property="og:video" content="${escapeHtml(videoUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta name="twitter:card" content="player" />
    <meta name="twitter:player" content="${escapeHtml(videoUrl)}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />`;
      }

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />${logoUrl ? `\n  <meta property="og:image" content="${escapeHtml(logoUrl)}" />` : ''}${videoTags}
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />${!videoUrl ? '\n  <meta name="twitter:card" content="summary_large_image" />' : ''}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(hashUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(hashUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>
`;

      const outDir = join(eventsDir, slug);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'index.html'), html, 'utf-8');
      generated++;
      console.log(`[OG] Generated ${slug}/index.html`);
    } catch (err) {
      console.error(`[OG] Failed to process ${jsonPath}:`, err.message);
    }
  }

  console.log(`[OG] Done: ${generated} event page(s) generated.`);
}

main().catch(console.error);
