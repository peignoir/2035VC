import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ControlsOverlay.module.css';

interface ControlsOverlayProps {
  isPaused: boolean;
  onTogglePause: () => void;
  onExit: () => void;
}

export function ControlsOverlay({
  isPaused,
  onTogglePause,
  onExit,
}: ControlsOverlayProps) {
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetHideTimer = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimerRef.current);
    if (!isPaused) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 2000);
    }
  }, [isPaused]);

  // Always show when paused
  useEffect(() => {
    if (isPaused) {
      setVisible(true);
      clearTimeout(hideTimerRef.current);
    } else {
      hideTimerRef.current = setTimeout(() => setVisible(false), 2000);
    }
    return () => clearTimeout(hideTimerRef.current);
  }, [isPaused]);

  // Show on mouse move
  useEffect(() => {
    const handler = () => resetHideTimer();
    document.addEventListener('mousemove', handler);
    return () => document.removeEventListener('mousemove', handler);
  }, [resetHideTimer]);

  return (
    <div
      className={`${styles.overlay} ${visible ? styles.visible : styles.hidden}`}
    >
      <div className={styles.controls}>
        {/* Pause / Resume */}
        <button
          className={styles.button}
          onClick={onTogglePause}
          aria-label={isPaused ? 'Resume' : 'Pause'}
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          )}
        </button>

        <div className={styles.divider} />

        {/* Stop presentation */}
        <button
          className={styles.button}
          onClick={onExit}
          aria-label="Stop presentation"
          title="Stop"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
