import * as pdfjsLib from 'pdfjs-dist';
import type { SlideImage, LoadedDeck } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const RENDER_SCALE = 2;
const REQUIRED_PAGES = 20;

export class PdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfValidationError';
  }
}

async function renderFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  onProgress?: (page: number) => void,
): Promise<LoadedDeck> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pdf.numPages !== REQUIRED_PAGES) {
    throw new PdfValidationError(
      `Your deck has ${pdf.numPages} slide${pdf.numPages !== 1 ? 's' : ''}. Ignite talks require exactly ${REQUIRED_PAGES} slides.`,
    );
  }

  const slides: SlideImage[] = [];

  for (let i = 1; i <= REQUIRED_PAGES; i++) {
    onProgress?.(i);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to render slide ${i}`));
        },
        'image/png',
      );
    });

    const objectUrl = URL.createObjectURL(blob);

    slides.push({
      pageNumber: i,
      objectUrl,
      width: viewport.width,
      height: viewport.height,
    });
  }

  return {
    fileName,
    slides,
    aspectRatio: slides[0].width / slides[0].height,
  };
}

/** Load a File (from dropzone) and render all slides */
export async function loadAndRenderPdf(
  file: File,
  onProgress?: (page: number) => void,
): Promise<LoadedDeck> {
  const arrayBuffer = await file.arrayBuffer();
  return renderFromArrayBuffer(arrayBuffer, file.name, onProgress);
}

/** Load a Blob (from IndexedDB) and render all slides */
export async function renderPdfFromBlob(
  blob: Blob,
  fileName: string,
  onProgress?: (page: number) => void,
): Promise<LoadedDeck> {
  const arrayBuffer = await blob.arrayBuffer();
  return renderFromArrayBuffer(arrayBuffer, fileName, onProgress);
}

/** Get page count without rendering (for validation UI) */
export async function getPdfPageCount(blob: Blob): Promise<number> {
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
