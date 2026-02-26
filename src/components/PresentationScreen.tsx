import { useRef, useState, useEffect, useCallback } from 'react';
import type { LoadedDeck } from '../types';
import type { OverlayInfo } from '../hooks/useMediaRecorder';
import { useFullscreen } from '../hooks/useFullscreen';
import { usePresentationTimer } from '../hooks/usePresentationTimer';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { SlideCanvas } from './SlideCanvas';
import { ControlsOverlay } from './ControlsOverlay';
import styles from './PresentationScreen.module.css';

const SLIDE_DURATION_MS = 15_000;
const TOTAL_SLIDES = 20;

interface PresentationScreenProps {
  deck: LoadedDeck;
  eventName?: string;
  storyName?: string;
  speakerName?: string;
  onExit: () => void;
  onFinish?: () => void;
  manageFullscreen?: boolean;
  recordingEnabled?: boolean;
  onRecordingComplete?: (blob: Blob) => void;
  audioStream?: MediaStream | null;
}

export function PresentationScreen({
  deck,
  eventName = '',
  storyName = '',
  speakerName = '',
  onExit,
  onFinish,
  manageFullscreen = true,
  recordingEnabled = false,
  onRecordingComplete,
  audioStream,
}: PresentationScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, requestFullscreen, exitFullscreen } = useFullscreen();
  const recorder = useMediaRecorder();
  const recorderStartedRef = useRef(false);
  const [waiting, setWaiting] = useState(true);

  // Stop recording helper — returns blob
  const finalizeRecording = useCallback(async () => {
    if (!recorderStartedRef.current) return;
    recorderStartedRef.current = false;
    const blob = await recorder.stopRecording();
    if (blob && onRecordingComplete) {
      onRecordingComplete(blob);
    }
  }, [recorder, onRecordingComplete]);

  const handleFinish = useCallback(() => {
    // Stop recording before finishing
    const finish = async () => {
      await finalizeRecording();
      setTimeout(() => {
        if (onFinish) {
          onFinish();
        } else {
          exitFullscreen().then(onExit);
        }
      }, 2000);
    };
    finish();
  }, [exitFullscreen, onExit, onFinish, finalizeRecording]);

  const {
    timerState,
    togglePause,
    resume,
  } = usePresentationTimer(handleFinish, !waiting);

  // Request fullscreen on mount (only for standalone mode)
  useEffect(() => {
    if (manageFullscreen && containerRef.current) {
      requestFullscreen(containerRef.current);
    }
  }, [manageFullscreen, requestFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else if (containerRef.current) {
      requestFullscreen(containerRef.current);
    }
  }, [isFullscreen, requestFullscreen, exitFullscreen]);

  const handleStart = useCallback(() => {
    setWaiting(false);
    resume();
    // Start recording when the talk begins
    if (recordingEnabled && !recorderStartedRef.current) {
      recorderStartedRef.current = true;
      recorder.startRecording(deck.slides, audioStream);
    }
  }, [resume, recordingEnabled, recorder, deck.slides, audioStream]);

  const handleStartFullscreen = useCallback(() => {
    if (containerRef.current) {
      requestFullscreen(containerRef.current);
    }
    handleStart();
  }, [requestFullscreen, handleStart]);

  // Build current overlay info for the recorder
  const makeOverlay = useCallback((): OverlayInfo => ({
    eventTitle: eventName,
    storyName,
    speakerName,
    currentSlide: timerState.currentSlide,
    totalSlides: TOTAL_SLIDES,
    slideSecondsLeft: Math.ceil((SLIDE_DURATION_MS - timerState.slideElapsed) / 1000),
  }), [eventName, storyName, speakerName, timerState.currentSlide, timerState.slideElapsed]);

  // Draw slide to recording canvas on slide change
  useEffect(() => {
    if (recorderStartedRef.current && recorder.isRecording) {
      recorder.drawSlide(deck.slides[timerState.currentSlide], makeOverlay());
    }
  }, [timerState.currentSlide, recorder, deck.slides, makeOverlay]);

  // Update overlay every second for timer countdown
  const prevSecondsRef = useRef(-1);
  useEffect(() => {
    if (!recorderStartedRef.current || !recorder.isRecording) return;
    const secsLeft = Math.ceil((SLIDE_DURATION_MS - timerState.slideElapsed) / 1000);
    if (secsLeft !== prevSecondsRef.current) {
      prevSecondsRef.current = secsLeft;
      recorder.updateOverlay(makeOverlay());
    }
  }, [timerState.slideElapsed, recorder, makeOverlay]);

  // Pause/resume recording with timer
  useEffect(() => {
    if (recorderStartedRef.current) {
      recorder.setPaused(timerState.isPaused);
    }
  }, [timerState.isPaused, recorder]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePause();
          break;
        case 'Escape':
          e.preventDefault();
          (async () => {
            await finalizeRecording();
            if (manageFullscreen) {
              exitFullscreen().then(onExit);
            } else {
              onExit();
            }
          })();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePause, exitFullscreen, onExit, manageFullscreen, finalizeRecording]);

  const handleExit = useCallback(async () => {
    await finalizeRecording();
    if (manageFullscreen) {
      exitFullscreen().then(onExit);
    } else {
      onExit();
    }
  }, [exitFullscreen, onExit, manageFullscreen, finalizeRecording]);

  const currentSlide = deck.slides[timerState.currentSlide];
  const slideSecondsLeft = Math.ceil(
    (SLIDE_DURATION_MS - timerState.slideElapsed) / 1000,
  );

  return (
    <div ref={containerRef} className={styles.container}>
      {waiting ? (
        <div className={styles.slideArea}>
          <SlideCanvas slide={deck.slides[0]} className={styles.slideImage} />
          <div className={styles.startOverlay}>
            <button className={styles.startButton} onClick={handleStart}>
              Start
            </button>
            <button className={styles.startFullscreenButton} onClick={handleStartFullscreen}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Fullscreen
            </button>
          </div>
        </div>
      ) : timerState.isFinished ? (
        <div className={styles.endOverlay}>
          <h2 className={styles.endTitle}>Talk Complete</h2>
          <p className={styles.endSubtitle}>5:00</p>
        </div>
      ) : (
        <>
          <div className={styles.slideArea}>
            <SlideCanvas slide={currentSlide} className={styles.slideImage} />
            <ControlsOverlay
              isPaused={timerState.isPaused}
              onTogglePause={togglePause}
              onExit={handleExit}
            />
            {recorder.isRecording && (
              <div className={styles.recordingIndicator}>
                <span className={styles.recordingDot} />
                <span>Live</span>
              </div>
            )}
          </div>

          <div className={styles.bottomBar}>
            <span className={styles.countdown}>{slideSecondsLeft}</span>

            <div className={styles.segments}>
              {Array.from({ length: TOTAL_SLIDES }, (_, i) => {
                const isCompleted = i < timerState.currentSlide;
                const isActive = i === timerState.currentSlide;

                const fillClass = [
                  styles.segmentFill,
                  isActive ? styles.segmentFillActive : '',
                  isActive && timerState.isPaused ? styles.segmentFillPaused : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div key={i} className={styles.segment}>
                    <div
                      className={fillClass}
                      style={isCompleted ? { width: '100%' } : undefined}
                    />
                  </div>
                );
              })}
            </div>

            <span className={styles.totalLabel}>5 min</span>

            <button
              className={styles.fullscreenButton}
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
