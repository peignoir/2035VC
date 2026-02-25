import { useState, useRef, useCallback, useEffect } from 'react';
import type { TimerState } from '../types';

const SLIDE_DURATION_MS = 15_000;
const TOTAL_SLIDES = 20;
const TOTAL_DURATION_MS = SLIDE_DURATION_MS * TOTAL_SLIDES; // 300_000 = 5 min

interface UsePresentationTimerReturn {
  timerState: TimerState;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  reset: () => void;
}

export function usePresentationTimer(
  onFinish?: () => void,
  autoStart = true,
): UsePresentationTimerReturn {
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const manualOffsetRef = useRef(0);
  const rafIdRef = useRef(0);
  const onFinishRef = useRef(onFinish);
  const hasFinishedRef = useRef(false);

  onFinishRef.current = onFinish;

  const [timerState, setTimerState] = useState<TimerState>({
    currentSlide: 0,
    slideElapsed: 0,
    totalElapsed: 0,
    isPaused: false,
    isFinished: false,
  });

  const getEffectiveElapsed = useCallback(() => {
    const now = pausedAtRef.current ?? performance.now();
    return now - startTimeRef.current - totalPausedMsRef.current + manualOffsetRef.current;
  }, []);

  const tick = useCallback(() => {
    const elapsed = getEffectiveElapsed();
    const clampedElapsed = Math.max(0, Math.min(elapsed, TOTAL_DURATION_MS));
    const currentSlide = Math.min(Math.floor(clampedElapsed / SLIDE_DURATION_MS), TOTAL_SLIDES - 1);
    const slideElapsed = clampedElapsed - currentSlide * SLIDE_DURATION_MS;
    const isFinished = clampedElapsed >= TOTAL_DURATION_MS;

    setTimerState({
      currentSlide,
      slideElapsed,
      totalElapsed: clampedElapsed,
      isPaused: pausedAtRef.current !== null,
      isFinished,
    });

    if (isFinished && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      onFinishRef.current?.();
      return;
    }

    if (!isFinished && pausedAtRef.current === null) {
      rafIdRef.current = requestAnimationFrame(tick);
    }
  }, [getEffectiveElapsed]);

  // Start the timer on mount (or paused if autoStart is false)
  useEffect(() => {
    startTimeRef.current = performance.now();
    totalPausedMsRef.current = 0;
    manualOffsetRef.current = 0;
    hasFinishedRef.current = false;

    if (autoStart) {
      pausedAtRef.current = null;
      rafIdRef.current = requestAnimationFrame(tick);
    } else {
      pausedAtRef.current = performance.now();
      setTimerState((prev) => ({ ...prev, isPaused: true }));
    }

    return () => {
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [tick, autoStart]);

  const pause = useCallback(() => {
    if (pausedAtRef.current !== null) return;
    pausedAtRef.current = performance.now();
    cancelAnimationFrame(rafIdRef.current);
    setTimerState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    if (pausedAtRef.current === null) return;
    totalPausedMsRef.current += performance.now() - pausedAtRef.current;
    pausedAtRef.current = null;
    setTimerState((prev) => ({ ...prev, isPaused: false }));
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const togglePause = useCallback(() => {
    if (pausedAtRef.current !== null) {
      resume();
    } else {
      pause();
    }
  }, [pause, resume]);

  const goToSlide = useCallback(
    (targetIndex: number) => {
      const clamped = Math.max(0, Math.min(targetIndex, TOTAL_SLIDES - 1));
      const targetElapsed = clamped * SLIDE_DURATION_MS;
      const currentEffective = getEffectiveElapsed();
      manualOffsetRef.current += targetElapsed - currentEffective;
      hasFinishedRef.current = false;

      // If paused, update immediately
      if (pausedAtRef.current !== null) {
        tick();
      }
    },
    [getEffectiveElapsed, tick],
  );

  const nextSlide = useCallback(() => {
    const current = Math.min(
      Math.floor(getEffectiveElapsed() / SLIDE_DURATION_MS),
      TOTAL_SLIDES - 1,
    );
    if (current < TOTAL_SLIDES - 1) {
      goToSlide(current + 1);
    }
  }, [getEffectiveElapsed, goToSlide]);

  const prevSlide = useCallback(() => {
    const current = Math.min(
      Math.floor(getEffectiveElapsed() / SLIDE_DURATION_MS),
      TOTAL_SLIDES - 1,
    );
    if (current > 0) {
      goToSlide(current - 1);
    }
  }, [getEffectiveElapsed, goToSlide]);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    startTimeRef.current = performance.now();
    pausedAtRef.current = null;
    totalPausedMsRef.current = 0;
    manualOffsetRef.current = 0;
    hasFinishedRef.current = false;
    setTimerState({
      currentSlide: 0,
      slideElapsed: 0,
      totalElapsed: 0,
      isPaused: false,
      isFinished: false,
    });
    rafIdRef.current = requestAnimationFrame(tick);
  }, [tick]);

  return {
    timerState,
    pause,
    resume,
    togglePause,
    nextSlide,
    prevSlide,
    goToSlide,
    reset,
  };
}
