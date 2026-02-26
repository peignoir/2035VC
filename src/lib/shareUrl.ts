import type { ShareableEvent } from '../types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'event';
}

/** Compress a string using the native CompressionStream API and return base64url */
async function compressToBase64url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(input)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(compressed);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decompress a base64url string back to the original string */
async function decompressFromBase64url(base64url: string): Promise<string> {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Build a hash fragment for a shareable event: #/live/slug~data */
export async function buildShareHash(event: ShareableEvent): Promise<string> {
  const json = JSON.stringify(event);
  const encoded = await compressToBase64url(json);
  const slug = slugify(event.name);
  return `#/live/${slug}~${encoded}`;
}

/** Build a full shareable URL */
export async function buildShareUrl(event: ShareableEvent): Promise<string> {
  const hash = await buildShareHash(event);
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}${hash}`;
}

/** Parse event data from a URL hash. Returns null if not a share URL. */
export async function parseShareUrl(hash: string): Promise<ShareableEvent | null> {
  // Match #/live/slug~data or legacy #/event/data
  const liveMatch = hash.match(/^#\/live\/[^~]+~(.+)$/);
  const legacyMatch = hash.match(/^#\/event\/(.+)$/);
  const encoded = liveMatch?.[1] ?? legacyMatch?.[1];
  if (!encoded) return null;
  try {
    const json = await decompressFromBase64url(encoded);
    return JSON.parse(json) as ShareableEvent;
  } catch {
    return null;
  }
}
