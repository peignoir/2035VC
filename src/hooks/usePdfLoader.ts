import { useState, useCallback } from 'react';
import type { LoadedDeck } from '../types';
import { loadAndRenderPdf, PdfValidationError } from '../lib/pdfRenderer';

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

interface UsePdfLoaderReturn {
  loadPdf: (file: File) => Promise<LoadedDeck>;
  isLoading: boolean;
  progress: number;
  error: string | null;
  clearError: () => void;
}

export function usePdfLoader(): UsePdfLoaderReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadPdf = useCallback(async (file: File): Promise<LoadedDeck> => {
    setError(null);
    setProgress(0);

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      const msg = 'Please upload a PDF file.';
      setError(msg);
      throw new PdfValidationError(msg);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const msg = `File is too large (${sizeMB} MB). Maximum size is 30 MB.`;
      setError(msg);
      throw new PdfValidationError(msg);
    }

    setIsLoading(true);

    try {
      const deck = await loadAndRenderPdf(file, (page) => {
        setProgress(page);
      });
      return deck;
    } catch (err) {
      const message =
        err instanceof PdfValidationError
          ? err.message
          : 'Failed to load PDF. The file may be corrupted or password-protected.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { loadPdf, isLoading, progress, error, clearError };
}
