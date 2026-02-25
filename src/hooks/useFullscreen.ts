import { useState, useCallback, useLayoutEffect } from 'react';

interface UseFullscreenReturn {
  isFullscreen: boolean;
  requestFullscreen: (element: HTMLElement) => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useLayoutEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const requestFullscreen = useCallback(async (el: HTMLElement) => {
    try {
      await el.requestFullscreen();
    } catch {
      console.warn('Fullscreen request denied or not supported');
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }, []);

  return { isFullscreen, requestFullscreen, exitFullscreen };
}
