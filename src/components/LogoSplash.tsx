import { useEffect, useCallback } from 'react';
import type { EventPresentation } from '../types';
import styles from './LogoSplash.module.css';

interface LogoSplashProps {
  logoUrl: string | null;
  eventName: string;
  presentations: EventPresentation[];
  playedIds: Set<string>;
  recordEnabled?: boolean;
  recordingUrls?: Map<string, string>;
  recordingTypes?: Map<string, string>;
  convertingMp4?: string | null;
  onPlay: (presId: string) => void;
  onDeleteRecording?: (presId: string) => void;
  onDownloadRecording?: (presId: string, fileName: string) => void;
  onDownloadMp4?: (presId: string, fileName: string) => void;
  onExit: () => void;
}

export function LogoSplash({
  logoUrl,
  eventName,
  presentations,
  playedIds,
  recordEnabled = false,
  recordingUrls,
  recordingTypes,
  convertingMp4,
  onPlay,
  onDeleteRecording,
  onDownloadRecording,
  onDownloadMp4,
  onExit,
}: LogoSplashProps) {
  const allPlayed = presentations.length > 0 && presentations.every((p) => playedIds.has(p.id));

  // Keyboard: Escape = Exit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onExit]);

  const handleFullscreen = useCallback((presId: string) => {
    const video = document.querySelector(`video[data-rec-id="${presId}"]`) as HTMLVideoElement | null;
    if (video) {
      video.requestFullscreen();
      video.play();
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {logoUrl ? (
          <img src={logoUrl} alt={eventName} className={styles.logo} draggable={false} />
        ) : (
          <h1 className={styles.eventName}>{eventName || 'Cafe 2035'}</h1>
        )}

        <div className={styles.action}>
          {allPlayed && (
            <p className={styles.status}>All talks delivered</p>
          )}

          <div className={styles.presList}>
            {presentations.map((pres) => {
              const played = playedIds.has(pres.id);
              const name = pres.storyName || pres.speakerName || pres.fileName;
              const speaker = pres.storyName && pres.speakerName ? pres.speakerName : null;
              const toneEmoji = pres.storyTone === 'white' ? '❤️' : pres.storyTone === 'black' ? '💩' : '⚖️';
              const hasRecording = recordingUrls?.has(pres.id) ?? false;
              const recUrl = recordingUrls?.get(pres.id);
              const recType = recordingTypes?.get(pres.id) || 'video/webm';
              const isNativeMp4 = recType.startsWith('video/mp4');

              return (
                <div key={pres.id} className={styles.presWrapper}>
                  <button
                    className={`${styles.presButton} ${played ? styles.presPlayed : ''}`}
                    onClick={() => onPlay(pres.id)}
                  >
                    <span className={styles.toneEmoji}>{toneEmoji}</span>
                    <span className={`${styles.presIcon} ${hasRecording ? styles.presIconRestart : ''}`}>
                      {hasRecording ? (
                        <span className={styles.presActionLabel}>Start Over</span>
                      ) : played ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className={styles.presActionLabel}>Go Live</span>
                      )}
                    </span>
                    <span className={styles.presLabel}>
                      <span className={styles.presName}>{name}</span>
                      {speaker && <span className={styles.presSubtitle}>{speaker}</span>}
                    </span>
                    {recordEnabled && hasRecording && (
                      <span className={styles.recBadgeDone} title="Recorded">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        REC
                      </span>
                    )}
                    {recordEnabled && !hasRecording && !played && (
                      <span className={styles.recBadge} title="Will be recorded">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444" stroke="none">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        REC
                      </span>
                    )}
                  </button>

                  {hasRecording && recUrl && (
                    <div className={styles.recStrip}>
                      <video
                        className={styles.recVideo}
                        src={recUrl}
                        data-rec-id={pres.id}
                        preload="auto"
                        controls
                        playsInline
                      />
                      <div className={styles.recActions}>
                        <button
                          className={styles.recAction}
                          onClick={() => handleFullscreen(pres.id)}
                          title="Fullscreen"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                          <span>Fullscreen</span>
                        </button>
                        <button
                          className={styles.recAction}
                          onClick={() => isNativeMp4
                            ? onDownloadMp4?.(pres.id, pres.fileName)
                            : onDownloadRecording?.(pres.id, pres.fileName)
                          }
                          title={`Download ${isNativeMp4 ? 'MP4' : 'WebM'}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span>Download</span>
                        </button>
                        {!isNativeMp4 && (
                          <button
                            className={styles.recAction}
                            onClick={() => onDownloadMp4?.(pres.id, pres.fileName)}
                            title="Convert to MP4"
                            disabled={convertingMp4 === pres.id}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>{convertingMp4 === pres.id ? 'Converting...' : 'MP4'}</span>
                          </button>
                        )}
                        <button
                          className={`${styles.recAction} ${styles.recActionDanger}`}
                          onClick={() => onDeleteRecording?.(pres.id)}
                          title="Delete recording"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className={styles.letsGo}>See 2035.</p>

          <button className={styles.exitButton} onClick={onExit}>
            Close the Window
          </button>
        </div>
      </div>

      <div className={styles.bottomInfo}>
        {eventName && <span>{eventName}</span>}
        {presentations.length > 0 && (
          <span className={styles.presCounter}>
            {playedIds.size} / {presentations.length}
          </span>
        )}
      </div>
    </div>
  );
}
