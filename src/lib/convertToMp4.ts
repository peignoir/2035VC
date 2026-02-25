import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();
  // Load from CDN (lazy, cached by browser after first load)
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
    workerURL: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js',
  });
  return ffmpeg;
}

/**
 * Convert a WebM blob to MP4 (H.264 + AAC) using FFmpeg WASM.
 * First call downloads ~22MB WASM core (cached by browser).
 */
export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const ff = await getFFmpeg();

  if (onProgress) {
    ff.on('progress', ({ progress }) => {
      onProgress(Math.min(progress, 1));
    });
  }

  const inputData = await fetchFile(webmBlob);
  await ff.writeFile('input.webm', inputData);

  await ff.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    'output.mp4',
  ]);

  const outputData = await ff.readFile('output.mp4');
  // Cast needed: FFmpeg returns Uint8Array<ArrayBufferLike>, Blob expects ArrayBuffer
  const buffer = (outputData as Uint8Array).buffer as ArrayBuffer;
  const mp4Blob = new Blob([new Uint8Array(buffer)], { type: 'video/mp4' });

  // Cleanup temp files
  await ff.deleteFile('input.webm');
  await ff.deleteFile('output.mp4');

  return mp4Blob;
}
