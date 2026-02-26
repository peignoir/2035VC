import type { ShareableEvent } from '../types';

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

/** Build a shareable URL for an event */
export async function buildShareUrl(event: ShareableEvent): Promise<string> {
  const json = JSON.stringify(event);
  const encoded = await compressToBase64url(json);
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}#/event/${encoded}`;
}

/** Parse event data from a URL hash. Returns null if not a share URL. */
export async function parseShareUrl(hash: string): Promise<ShareableEvent | null> {
  const match = hash.match(/^#\/event\/(.+)$/);
  if (!match) return null;
  try {
    const json = await decompressFromBase64url(match[1]);
    return JSON.parse(json) as ShareableEvent;
  } catch {
    return null;
  }
}
