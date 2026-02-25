import { useRef, useState, useCallback } from 'react';
import fixWebmDuration from 'fix-webm-duration';
import type { SlideImage } from '../types';

function pickMimeType(): string {
  const candidates = [
    // MP4 first — Safari records natively in MP4 (H.264+AAC), plays in <video>
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    // WebM fallback — Chrome/Firefox
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

/** Overlay data burned into the recorded video */
export interface OverlayInfo {
  eventTitle: string;
  storyName: string;
  speakerName: string;
  currentSlide: number;     // 0-based (0–19)
  totalSlides: number;      // 20
  slideSecondsLeft: number; // countdown per slide (15→0)
}

export interface MediaRecorderHandle {
  startRecording: (slides: SlideImage[], preAcquiredAudio?: MediaStream | null) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  drawSlide: (slide: SlideImage, overlay?: OverlayInfo) => void;
  updateOverlay: (overlay: OverlayInfo) => void;
  setPaused: (paused: boolean) => void;
  isRecording: boolean;
  micDenied: boolean;
}

/** Draw event/story/speaker info + progress bar over the current canvas content */
function drawOverlayOnCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  overlay: OverlayInfo,
) {
  const { eventTitle, storyName, speakerName, currentSlide, totalSlides, slideSecondsLeft } = overlay;

  // ── Top-left info block: event name, story name, speaker name ──
  const lineH = Math.round(h * 0.032);
  const baseFontSize = Math.round(h * 0.026);
  const padX = Math.round(w * 0.02);
  const padY = Math.round(h * 0.02);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.textBaseline = 'top';

  let y = padY;

  // Event name (bold)
  if (eventTitle) {
    ctx.font = `bold ${baseFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(eventTitle, padX, y);
    y += lineH;
  }

  // Story name (semibold, slightly smaller)
  if (storyName) {
    ctx.font = `600 ${Math.round(baseFontSize * 0.9)}px sans-serif`;
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(storyName, padX, y);
    y += lineH;
  }

  // Speaker name (normal weight)
  if (speakerName) {
    ctx.font = `400 ${Math.round(baseFontSize * 0.85)}px sans-serif`;
    ctx.fillStyle = '#b0b0b0';
    ctx.fillText(speakerName, padX, y);
  }

  ctx.restore();

  // ── Bottom bar ──
  const barH = Math.round(h * 0.04);
  const barY = h - barH;
  const barPad = Math.round(w * 0.015);
  const segGap = Math.round(w * 0.003);

  // Semi-transparent background
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, barY, w, barH);

  // Countdown number (left)
  const countFontSize = Math.round(barH * 0.55);
  ctx.font = `bold ${countFontSize}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ef4444';
  const countText = String(slideSecondsLeft);
  const countWidth = ctx.measureText('00').width;
  ctx.fillText(countText, barPad, barY + barH / 2);

  // "5 min" label (right)
  ctx.font = `600 ${Math.round(barH * 0.45)}px monospace`;
  ctx.fillStyle = '#ffffff';
  const labelText = '5 min';
  const labelWidth = ctx.measureText(labelText).width;
  ctx.fillText(labelText, w - barPad - labelWidth, barY + barH / 2);

  // Segments area
  const segsLeft = barPad + countWidth + barPad;
  const segsRight = w - barPad - labelWidth - barPad;
  const totalSegsWidth = segsRight - segsLeft;
  const segWidth = (totalSegsWidth - (totalSlides - 1) * segGap) / totalSlides;
  const segH = Math.round(barH * 0.25);
  const segY = barY + (barH - segH) / 2;

  for (let i = 0; i < totalSlides; i++) {
    const sx = segsLeft + i * (segWidth + segGap);

    // Background segment
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(sx, segY, segWidth, segH);

    // Fill for completed slides
    if (i < currentSlide) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx, segY, segWidth, segH);
    } else if (i === currentSlide) {
      // Active slide: partial fill based on elapsed time
      const progress = 1 - slideSecondsLeft / 15;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(sx, segY, segWidth * Math.max(0, Math.min(progress, 1)), segH);
    }
  }

  ctx.restore();
}

export function useMediaRecorder(): MediaRecorderHandle {
  const [isRecording, setIsRecording] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef('');
  const startTimeRef = useRef(0);
  const lastImageRef = useRef<HTMLImageElement | null>(null);

  const pushFrame = useCallback(() => {
    const stream = canvasStreamRef.current;
    const videoTrack = stream?.getVideoTracks()[0];
    if (videoTrack && 'requestFrame' in videoTrack) {
      (videoTrack as CanvasCaptureMediaStreamTrack).requestFrame();
    }
  }, []);

  const drawSlide = useCallback((slide: SlideImage, overlay?: OverlayInfo) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      lastImageRef.current = img;
      if (overlay) {
        drawOverlayOnCanvas(ctx, canvas.width, canvas.height, overlay);
      }
      pushFrame();
    };
    img.src = slide.objectUrl;
  }, [pushFrame]);

  /** Redraw cached slide + updated overlay (called every second for timer updates) */
  const updateOverlay = useCallback((overlay: OverlayInfo) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    const img = lastImageRef.current;
    if (!ctx || !canvas || !img) return;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawOverlayOnCanvas(ctx, canvas.width, canvas.height, overlay);
    pushFrame();
  }, [pushFrame]);

  const startRecording = useCallback(async (slides: SlideImage[], preAcquiredAudio?: MediaStream | null) => {
    // Check browser support
    if (typeof MediaRecorder === 'undefined') return;
    const mime = pickMimeType();
    if (!mime) return;
    mimeRef.current = mime;

    // Bail if captureStream not supported
    const testCanvas = document.createElement('canvas');
    if (!testCanvas.captureStream) return;

    // Create offscreen canvas – cap at 1280×720 to keep memory low during 5-min recordings.
    // Slides are rendered at 2× for display, but that resolution is overkill for recording.
    const firstSlide = slides[0];
    if (!firstSlide) return;

    const MAX_W = 1280;
    const MAX_H = 720;
    const aspect = firstSlide.width / firstSlide.height;
    let recW = firstSlide.width;
    let recH = firstSlide.height;
    if (recW > MAX_W) { recW = MAX_W; recH = Math.round(recW / aspect); }
    if (recH > MAX_H) { recH = MAX_H; recW = Math.round(recH * aspect); }

    const canvas = document.createElement('canvas');
    canvas.width = recW;
    canvas.height = recH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvasRef.current = canvas;
    ctxRef.current = ctx;

    // Capture canvas stream at 1fps for proper frame timing + manual pushes on slide change
    const canvasStream = canvas.captureStream(1);
    canvasStreamRef.current = canvasStream;

    // Use pre-acquired audio stream, or request mic if not provided
    let audioStream: MediaStream | null = preAcquiredAudio ?? null;
    if (!audioStream) {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicDenied(false);
      } catch {
        setMicDenied(true);
      }
    } else {
      setMicDenied(false);
    }
    audioStreamRef.current = audioStream;

    // Combine streams
    const combinedStream = new MediaStream();
    for (const track of canvasStream.getTracks()) {
      combinedStream.addTrack(track);
    }
    if (audioStream) {
      for (const track of audioStream.getTracks()) {
        combinedStream.addTrack(track);
      }
    }

    // Create recorder
    chunksRef.current = [];
    const recorder = new MediaRecorder(combinedStream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    recorder.onerror = (e) => {
      console.error('[MediaRecorder] error – stopping:', e);
      cleanup();
    };
    recorderRef.current = recorder;
    recorder.start(10_000); // collect chunks every 10s (30 chunks over 5 min vs 300)
    startTimeRef.current = Date.now();
    setIsRecording(true);

    // Draw first slide (overlay will be added by PresentationScreen interval)
    drawSlide(firstSlide);
  }, [drawSlide]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        let blob = new Blob(chunksRef.current, { type: mimeRef.current });
        chunksRef.current = [];

        // Fix WebM duration metadata so video players show correct duration/seekbar
        // (MP4 recordings from Safari don't need this)
        const isWebm = mimeRef.current.startsWith('video/webm');
        if (isWebm && blob.size > 0 && startTimeRef.current > 0) {
          const duration = Date.now() - startTimeRef.current;
          try {
            blob = await fixWebmDuration(blob, duration, { logger: false });
          } catch {
            // Fall back to unfixed blob
          }
        }

        cleanup();
        resolve(blob.size > 0 ? blob : null);
      };

      recorder.stop();
    });
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    if (paused && recorder.state === 'recording') {
      recorder.pause();
    } else if (!paused && recorder.state === 'paused') {
      recorder.resume();
    }
  }, []);

  function cleanup() {
    // Stop all audio tracks
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;

    // Stop canvas stream tracks
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;

    canvasRef.current = null;
    ctxRef.current = null;
    recorderRef.current = null;
    lastImageRef.current = null;
    setIsRecording(false);
  }

  return {
    startRecording,
    stopRecording,
    drawSlide,
    updateOverlay,
    setPaused,
    isRecording,
    micDenied,
  };
}
