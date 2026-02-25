import { useState, useEffect, useCallback, useRef } from 'react';
import type { IgniteEvent, EventPresentation, LoadedDeck } from '../types';
import { getEvent, getEventPresentations, getLogoBlob, getPdfBlob, putRecordingBlob, getRecordingBlob, deleteRecordingBlob } from '../lib/db';
import { renderPdfFromBlob } from '../lib/pdfRenderer';
import { convertWebmToMp4 } from '../lib/convertToMp4';
import { generateLogo } from '../lib/generateLogo';
import { useFullscreen } from '../hooks/useFullscreen';
import { PresentationScreen } from './PresentationScreen';
import { LogoSplash } from './LogoSplash';
import styles from './EventRunScreen.module.css';

type RunState = 'loading' | 'logo-splash' | 'rendering' | 'presenting';

interface EventRunScreenProps {
  eventId: string;
  onExit: () => void;
}

export function EventRunScreen({ eventId, onExit }: EventRunScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { exitFullscreen } = useFullscreen();

  const [runState, setRunState] = useState<RunState>('loading');
  const [event, setEvent] = useState<IgniteEvent | null>(null);
  const [presentations, setPresentations] = useState<EventPresentation[]>([]);
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());
  const [currentPresId, setCurrentPresId] = useState<string | null>(null);
  const [currentDeck, setCurrentDeck] = useState<LoadedDeck | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());
  const [recordingUrls, setRecordingUrls] = useState<Map<string, string>>(new Map());
  const [recordingTypes, setRecordingTypes] = useState<Map<string, string>>(new Map());
  const [confirmPresId, setConfirmPresId] = useState<string | null>(null);
  const [convertingMp4, setConvertingMp4] = useState<string | null>(null);

  // Load event data on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ev = await getEvent(eventId);
      const pres = await getEventPresentations(eventId);
      const logoBlob = await getLogoBlob(eventId);

      if (cancelled) return;
      setEvent(ev ?? null);
      setPresentations(pres);
      if (logoBlob) {
        setLogoUrl(URL.createObjectURL(logoBlob));
      } else if (ev) {
        try {
          const generated = await generateLogo(ev.name, ev.city);
          if (!cancelled) setLogoUrl(URL.createObjectURL(generated));
        } catch {
          // Fall back to text-only display
        }
      }

      // Check which presentations already have recordings + create URLs
      if (ev?.recordEnabled) {
        const recIds = new Set<string>();
        const recUrls = new Map<string, string>();
        const recTypes = new Map<string, string>();
        for (const p of pres) {
          const rec = await getRecordingBlob(p.id);
          if (rec) {
            recIds.add(p.id);
            recUrls.set(p.id, URL.createObjectURL(rec));
            recTypes.set(p.id, rec.type || 'video/webm');
          }
        }
        if (!cancelled) {
          setRecordedIds(recIds);
          setRecordingUrls(recUrls);
          setRecordingTypes(recTypes);
        } else {
          recUrls.forEach((url) => URL.revokeObjectURL(url));
        }
      }

      setRunState('logo-splash');
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  // No auto-fullscreen — user can toggle via button on bottom bar

  // Cleanup
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  // Cleanup recording URLs on unmount
  useEffect(() => {
    return () => {
      recordingUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Actual play logic (called directly or after confirm)
  const startPlay = useCallback(async (presId: string) => {
    const pres = presentations.find((p) => p.id === presId);
    if (!pres) return;
    setCurrentPresId(presId);
    setConfirmPresId(null);
    setRunState('rendering');
    setRenderProgress(0);

    try {
      // If recording is enabled, request mic permission NOW (before fullscreen/presenting)
      let micStream: MediaStream | null = null;
      if (event?.recordEnabled) {
        // Delete old recording first — new one will replace it
        if (recordedIds.has(presId)) {
          await deleteRecordingBlob(presId);
          setRecordedIds((prev) => {
            const next = new Set(prev);
            next.delete(presId);
            return next;
          });
          setRecordingUrls((prev) => {
            const oldUrl = prev.get(presId);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            const next = new Map(prev);
            next.delete(presId);
            return next;
          });
          setRecordingTypes((prev) => {
            const next = new Map(prev);
            next.delete(presId);
            return next;
          });
        }
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          // User denied mic — will record video-only
        }
        setAudioStream(micStream);
      }

      const blob = await getPdfBlob(pres.id);
      if (!blob) throw new Error('PDF not found');
      const deck = await renderPdfFromBlob(blob, pres.fileName, (page) => {
        setRenderProgress(page);
      });
      setCurrentDeck(deck);
      setRunState('presenting');
    } catch {
      setRunState('logo-splash');
    }
  }, [presentations, event?.recordEnabled, recordedIds]);

  // Entry point: check for existing recording before playing
  const handlePlay = useCallback((presId: string) => {
    if (event?.recordEnabled && recordedIds.has(presId)) {
      // Show confirmation dialog
      setConfirmPresId(presId);
    } else {
      startPlay(presId);
    }
  }, [event?.recordEnabled, recordedIds, startPlay]);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    if (currentPresId) {
      await putRecordingBlob(currentPresId, blob);
      setRecordedIds((prev) => new Set(prev).add(currentPresId));
      const url = URL.createObjectURL(blob);
      setRecordingUrls((prev) => {
        const next = new Map(prev);
        next.set(currentPresId, url);
        return next;
      });
      setRecordingTypes((prev) => {
        const next = new Map(prev);
        next.set(currentPresId, blob.type || 'video/webm');
        return next;
      });
    }
  }, [currentPresId]);

  const handleDeleteRecording = useCallback(async (presId: string) => {
    await deleteRecordingBlob(presId);
    setRecordingUrls((prev) => {
      const oldUrl = prev.get(presId);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const next = new Map(prev);
      next.delete(presId);
      return next;
    });
    setRecordedIds((prev) => {
      const next = new Set(prev);
      next.delete(presId);
      return next;
    });
    setRecordingTypes((prev) => {
      const next = new Map(prev);
      next.delete(presId);
      return next;
    });
  }, []);

  const handleDownloadRecording = useCallback((presId: string, fileName: string) => {
    const url = recordingUrls.get(presId);
    if (!url) return;
    const type = recordingTypes.get(presId) || 'video/webm';
    const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
    const base = fileName.replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}-recording.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [recordingUrls, recordingTypes]);

  const handleDownloadMp4 = useCallback(async (presId: string, fileName: string) => {
    const url = recordingUrls.get(presId);
    if (!url) return;
    const type = recordingTypes.get(presId) || 'video/webm';
    const base = fileName.replace(/\.[^.]+$/, '');

    // Already MP4 — just download directly, no conversion needed
    if (type.startsWith('video/mp4')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}-recording.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // WebM → MP4 conversion via FFmpeg WASM
    setConvertingMp4(presId);
    try {
      const response = await fetch(url);
      const webmBlob = await response.blob();
      const mp4Blob = await convertWebmToMp4(webmBlob);
      const mp4Url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = `${base}-recording.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(mp4Url);
    } catch (err) {
      console.error('MP4 conversion failed:', err);
    } finally {
      setConvertingMp4(null);
    }
  }, [recordingUrls, recordingTypes]);

  const handlePresentationFinish = useCallback(() => {
    // Revoke blob URLs from finished deck
    if (currentDeck) {
      currentDeck.slides.forEach((s) => URL.revokeObjectURL(s.objectUrl));
    }
    setCurrentDeck(null);

    // Mark as played
    if (currentPresId) {
      setPlayedIds((prev) => new Set(prev).add(currentPresId));
    }
    setCurrentPresId(null);
    setRunState('logo-splash');
  }, [currentDeck, currentPresId]);

  // Called when user hits Stop during a presentation — go back to picker
  const handleStop = useCallback(() => {
    if (currentDeck) {
      currentDeck.slides.forEach((s) => URL.revokeObjectURL(s.objectUrl));
    }
    setCurrentDeck(null);
    setCurrentPresId(null);
    setRunState('logo-splash');
  }, [currentDeck]);

  const handleExit = useCallback(() => {
    if (currentDeck) {
      currentDeck.slides.forEach((s) => URL.revokeObjectURL(s.objectUrl));
    }
    exitFullscreen().then(onExit);
  }, [currentDeck, exitFullscreen, onExit]);

  const eventName = event?.name ?? '';

  return (
    <div ref={containerRef} className={styles.container}>
      {runState === 'loading' && (
        <div className={styles.loadingScreen}>Loading...</div>
      )}

      {runState === 'rendering' && (
        <div className={styles.loadingScreen}>
          <div className={styles.renderBar}>
            <div className={styles.renderFill} style={{ width: `${(renderProgress / 20) * 100}%` }} />
          </div>
          <p>Rendering slide {renderProgress} of 20...</p>
        </div>
      )}

      {runState === 'logo-splash' && (
        <>
          <LogoSplash
            logoUrl={logoUrl}
            eventName={eventName}
            presentations={presentations}
            playedIds={playedIds}
            recordEnabled={event?.recordEnabled ?? false}
            recordingUrls={recordingUrls}
            recordingTypes={recordingTypes}
            onPlay={handlePlay}
            convertingMp4={convertingMp4}
            onDeleteRecording={handleDeleteRecording}
            onDownloadRecording={handleDownloadRecording}
            onDownloadMp4={handleDownloadMp4}
            onExit={handleExit}
          />
          {confirmPresId && (
            <div className={styles.confirmOverlay}>
              <div className={styles.confirmDialog}>
                <p className={styles.confirmText}>
                  This talk already has a recording. Starting a new one will <strong>delete the previous recording</strong>.
                </p>
                <div className={styles.confirmButtons}>
                  <button
                    className={styles.confirmCancel}
                    onClick={() => setConfirmPresId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.confirmProceed}
                    onClick={() => startPlay(confirmPresId)}
                  >
                    Record again
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {runState === 'presenting' && currentDeck && (() => {
        const currentPres = presentations.find((p) => p.id === currentPresId);
        return (
          <PresentationScreen
            deck={currentDeck}
            eventName={eventName}
            storyName={currentPres?.storyName ?? ''}
            speakerName={currentPres?.speakerName ?? ''}
            onExit={handleStop}
            onFinish={handlePresentationFinish}
            manageFullscreen={false}
            recordingEnabled={event?.recordEnabled ?? false}
            onRecordingComplete={handleRecordingComplete}
            audioStream={audioStream}
          />
        );
      })()}
    </div>
  );
}
