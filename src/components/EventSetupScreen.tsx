import { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import type { IgniteEvent, EventPresentation, StoryTone, ShareableEvent } from '../types';
import {
  getEvent, putEvent,
  getEventPresentations, putPresentation, deletePresentation, reorderPresentations,
  getLogoBlob, putLogoBlob, deleteLogoBlob,
  putPdfBlob,
  getRecordingBlob, deleteRecordingBlob,
} from '../lib/db';
import { loadAndRenderPdf, PdfValidationError } from '../lib/pdfRenderer';
import { convertWebmToMp4 } from '../lib/convertToMp4';
import { buildShareHash } from '../lib/shareUrl';
import styles from './EventSetupScreen.module.css';

interface EventSetupScreenProps {
  eventId: string;
  onBack: () => void;
  onOpenLanding?: (event: ShareableEvent, hash: string, logoUrl?: string) => void;
}

export function EventSetupScreen({ eventId, onBack, onOpenLanding }: EventSetupScreenProps) {
  const [event, setEvent] = useState<IgniteEvent | null>(null);
  const [presentations, setPresentations] = useState<EventPresentation[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [recordingUrls, setRecordingUrls] = useState<Map<string, string>>(new Map());
  const [convertingMp4, setConvertingMp4] = useState<string | null>(null); // presId being converted
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load event data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ev = await getEvent(eventId);
      if (!ev) {
        ev = {
          id: eventId,
          name: '',
          city: '',
          date: new Date().toISOString().split('T')[0],
          link: '',
          recordEnabled: false,
          createdAt: Date.now(),
        };
        await putEvent(ev);
      }
      if (!cancelled) setEvent(ev);

      const pres = await getEventPresentations(eventId);
      if (!cancelled) setPresentations(pres);

      const logoBlob = await getLogoBlob(eventId);
      if (!cancelled && logoBlob) {
        setLogoUrl(URL.createObjectURL(logoBlob));
      }

      // Load recording blob URLs
      const recUrls = new Map<string, string>();
      for (const p of pres) {
        const recBlob = await getRecordingBlob(p.id);
        if (cancelled) return;
        if (recBlob) {
          recUrls.set(p.id, URL.createObjectURL(recBlob));
        }
      }
      if (!cancelled) setRecordingUrls(recUrls);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Cleanup logo blob URL
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  // Cleanup recording blob URLs
  useEffect(() => {
    return () => {
      recordingUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save event fields
  const saveEvent = useCallback((updated: IgniteEvent) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => putEvent(updated), 500);
  }, []);

  const toggleRecording = useCallback(() => {
    setEvent((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, recordEnabled: !prev.recordEnabled };
      putEvent(updated);
      return updated;
    });
  }, []);

  const updateField = useCallback((field: keyof IgniteEvent, value: string) => {
    setEvent((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      saveEvent(updated);
      return updated;
    });
  }, [saveEvent]);

  // Logo upload
  const onLogoDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    await putLogoBlob(eventId, file);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(URL.createObjectURL(file));
  }, [eventId, logoUrl]);

  const handleRemoveLogo = useCallback(async () => {
    await deleteLogoBlob(eventId);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(null);
  }, [eventId, logoUrl]);

  const logoDropzone = useDropzone({
    onDrop: onLogoDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] },
    multiple: false,
  });

  // PDF upload
  const onPdfDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setPdfError(null);
    setPdfLoading(true);
    setPdfProgress(0);

    try {
      // Validate by rendering (checks 20 pages)
      const deck = await loadAndRenderPdf(file, (page) => setPdfProgress(page));
      // Revoke rendered blob URLs — we only needed validation
      deck.slides.forEach((s) => URL.revokeObjectURL(s.objectUrl));

      const presId = crypto.randomUUID();
      const newPres: EventPresentation = {
        id: presId,
        eventId,
        fileName: file.name,
        speakerName: '',
        storyName: '',
        storyTone: 'neutral',
        order: presentations.length,
      };
      await putPresentation(newPres);
      await putPdfBlob(presId, file);
      setPresentations((prev) => [...prev, newPres]);
    } catch (err) {
      if (err instanceof PdfValidationError) {
        setPdfError(err.message);
      } else {
        setPdfError('Failed to load PDF. The file may be corrupted.');
      }
    } finally {
      setPdfLoading(false);
    }
  }, [eventId, presentations.length]);

  const pdfDropzone = useDropzone({
    onDrop: onPdfDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 30 * 1024 * 1024,
    multiple: false,
    disabled: pdfLoading,
  });

  // Update presentation fields (speaker name, story name)
  const updatePresField = useCallback((presId: string, field: 'speakerName' | 'storyName' | 'storyTone' | 'speakerBio' | 'socialX' | 'socialInstagram' | 'socialLinkedin', value: string) => {
    setPresentations((prev) => {
      const updated = prev.map((p) =>
        p.id === presId ? { ...p, [field]: value } : p,
      );
      const pres = updated.find((p) => p.id === presId);
      if (pres) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => putPresentation(pres), 500);
      }
      return updated;
    });
  }, []);

  // Download recording
  const handleDownloadRecording = useCallback((presId: string, fileName: string) => {
    const url = recordingUrls.get(presId);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    // Name it after speaker or filename, with .webm extension
    const baseName = fileName.replace(/\.pdf$/i, '');
    a.download = `${baseName}-recording.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [recordingUrls]);

  // Download recording as MP4 (converts via FFmpeg WASM)
  const handleDownloadMp4 = useCallback(async (presId: string, fileName: string) => {
    const url = recordingUrls.get(presId);
    if (!url) return;
    setConvertingMp4(presId);
    try {
      const response = await fetch(url);
      const webmBlob = await response.blob();
      const mp4Blob = await convertWebmToMp4(webmBlob);
      const baseName = fileName.replace(/\.pdf$/i, '');
      const mp4Url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = `${baseName}-recording.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(mp4Url);
    } catch (err) {
      console.error('MP4 conversion failed:', err);
      alert('MP4 conversion failed. Try downloading WebM instead.');
    } finally {
      setConvertingMp4(null);
    }
  }, [recordingUrls]);

  // Fullscreen playback
  const handleFullscreenPlay = useCallback((presId: string) => {
    const video = document.querySelector(`[data-rec-id="${presId}"]`) as HTMLVideoElement | null;
    if (video) {
      video.requestFullscreen?.();
      video.play();
    }
  }, []);

  // Delete recording
  const handleDeleteRecording = useCallback(async (presId: string) => {
    await deleteRecordingBlob(presId);
    setRecordingUrls((prev) => {
      const oldUrl = prev.get(presId);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const next = new Map(prev);
      next.delete(presId);
      return next;
    });
  }, []);

  // Delete presentation
  const handleDeletePres = useCallback(async (presId: string) => {
    // Clean up recording URL if exists
    const recUrl = recordingUrls.get(presId);
    if (recUrl) URL.revokeObjectURL(recUrl);
    setRecordingUrls((prev) => {
      const next = new Map(prev);
      next.delete(presId);
      return next;
    });
    await deletePresentation(presId);
    setPresentations((prev) => prev.filter((p) => p.id !== presId));
  }, [recordingUrls]);

  // Reorder
  const handleMove = useCallback(async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= presentations.length) return;
    const newList = [...presentations];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    const orderedIds = newList.map((p) => p.id);
    setPresentations(newList);
    await reorderPresentations(eventId, orderedIds);
  }, [presentations, eventId]);

  const handleOpenPublicPage = useCallback(async () => {
    if (!event || !onOpenLanding) return;
    const shareable: ShareableEvent = {
      name: event.name,
      city: event.city,
      date: event.date,
      link: event.link,
      presentations: presentations.map((p) => ({
        speakerName: p.speakerName,
        storyName: p.storyName,
        storyTone: p.storyTone,
        speakerBio: p.speakerBio,
        socialX: p.socialX,
        socialInstagram: p.socialInstagram,
        socialLinkedin: p.socialLinkedin,
      })),
    };
    const hash = await buildShareHash(shareable);
    onOpenLanding(shareable, hash, logoUrl ?? undefined);
  }, [event, presentations, onOpenLanding, logoUrl]);

  if (!event) {
    return <div className={styles.container}><div className={styles.loading}>Loading...</div></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Gatherings
        </button>
        {onOpenLanding && (
          <button className={styles.shareButton} onClick={handleOpenPublicPage}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Public Page
          </button>
        )}
      </header>

      <div className={styles.form}>
        {/* Event details */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gathering Details</h2>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Chapter Name</label>
            <input
              className={styles.input}
              type="text"
              value={event.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Café 2035 Tallinn"
              autoFocus={!event.name}
            />
          </div>
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>City</label>
              <input
                className={styles.input}
                type="text"
                value={event.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="e.g. Tallinn"
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Date</label>
              <input
                className={styles.input}
                type="date"
                value={event.date}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Gathering Link</label>
            <input
              className={styles.input}
              type="url"
              value={event.link ?? ''}
              onChange={(e) => updateField('link', e.target.value)}
              placeholder="e.g. https://lu.ma/your-event"
            />
          </div>

          <div className={styles.toggleRow}>
            <button
              className={`${styles.toggle} ${event.recordEnabled ? styles.toggleOn : ''}`}
              onClick={toggleRecording}
              type="button"
              aria-pressed={event.recordEnabled}
            >
              <span className={styles.toggleThumb} />
            </button>
            <span className={styles.toggleLabel}>
              Capture {event.recordEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </section>

        {/* Logo */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Chapter Logo</h2>
          {logoUrl ? (
            <div className={styles.logoPreview}>
              <img src={logoUrl} alt="Event logo" className={styles.logoImage} />
              <button className={styles.removeLogo} onClick={handleRemoveLogo}>Remove</button>
            </div>
          ) : (
            <div {...logoDropzone.getRootProps()} className={`${styles.dropzone} ${styles.dropzoneSmall}`}>
              <input {...logoDropzone.getInputProps()} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Drop your chapter logo, or click to browse</span>
            </div>
          )}
        </section>

        {/* Presentations */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Stories
            {presentations.length > 0 && (
              <span className={styles.badge}>{presentations.length}</span>
            )}
          </h2>

          {presentations.length > 0 && (
            <div className={styles.presList}>
              {presentations.map((pres, index) => (
                <div key={pres.id} className={styles.presItem}>
                  <div className={styles.presOrder}>
                    <button
                      className={styles.arrowButton}
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <span className={styles.presNumber}>{index + 1}</span>
                    <button
                      className={styles.arrowButton}
                      onClick={() => handleMove(index, 1)}
                      disabled={index === presentations.length - 1}
                      aria-label="Move down"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                  <div className={styles.presInfo}>
                    <div className={styles.presFileRow}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className={styles.presFileName}>{pres.fileName}</span>
                      <span className={styles.presSlides}>20 slides</span>
                    </div>
                    <div className={styles.presFields}>
                      <input
                        className={`${styles.presInput} ${!pres.speakerName?.trim() ? styles.presInputRequired : ''}`}
                        type="text"
                        value={pres.speakerName ?? ''}
                        onChange={(e) => updatePresField(pres.id, 'speakerName', e.target.value)}
                        placeholder="Speaker name *"
                      />
                      <input
                        className={`${styles.presInput} ${!pres.storyName?.trim() ? styles.presInputRequired : ''}`}
                        type="text"
                        value={pres.storyName ?? ''}
                        onChange={(e) => updatePresField(pres.id, 'storyName', e.target.value)}
                        placeholder="Story name *"
                      />
                    </div>
                    <div className={styles.toneRow}>
                      <span className={styles.toneRowLabel}>Story vibe</span>
                      {([
                        ['white', '❤️', 'Bloom'],
                        ['neutral', '⚖️', 'Balance'],
                        ['black', '💩', 'Doom'],
                      ] as [StoryTone, string, string][]).map(([tone, emoji, label]) => (
                        <button
                          key={tone}
                          className={`${styles.toneButton} ${(pres.storyTone ?? 'neutral') === tone ? styles.toneActive : ''}`}
                          onClick={() => updatePresField(pres.id, 'storyTone', tone)}
                          title={label}
                          type="button"
                        >
                          <span>{emoji}</span>
                          <span className={styles.toneLabel}>{label}</span>
                        </button>
                      ))}
                    </div>
                    <textarea
                      className={styles.presTextarea}
                      value={pres.speakerBio ?? ''}
                      onChange={(e) => updatePresField(pres.id, 'speakerBio', e.target.value)}
                      placeholder="Short speaker bio (optional)"
                      rows={2}
                    />
                    <div className={styles.socialRow}>
                      <div className={styles.socialField}>
                        <span className={styles.socialIcon}>𝕏</span>
                        <input
                          className={styles.presInput}
                          type="text"
                          value={pres.socialX ?? ''}
                          onChange={(e) => updatePresField(pres.id, 'socialX', e.target.value)}
                          placeholder="@handle"
                        />
                      </div>
                      <div className={styles.socialField}>
                        <span className={styles.socialIcon}>IG</span>
                        <input
                          className={styles.presInput}
                          type="text"
                          value={pres.socialInstagram ?? ''}
                          onChange={(e) => updatePresField(pres.id, 'socialInstagram', e.target.value)}
                          placeholder="@handle"
                        />
                      </div>
                      <div className={styles.socialField}>
                        <span className={styles.socialIcon}>in</span>
                        <input
                          className={styles.presInput}
                          type="text"
                          value={pres.socialLinkedin ?? ''}
                          onChange={(e) => updatePresField(pres.id, 'socialLinkedin', e.target.value)}
                          placeholder="LinkedIn URL"
                        />
                      </div>
                    </div>
                    {recordingUrls.has(pres.id) && (
                      <div className={styles.recordingPreview}>
                        <video
                          className={styles.recordingVideo}
                          data-rec-id={pres.id}
                          src={recordingUrls.get(pres.id)}
                          controls
                          preload="metadata"
                        />
                        <div className={styles.recordingActions}>
                          <button
                            className={styles.recordingAction}
                            onClick={() => handleFullscreenPlay(pres.id)}
                            title="Play fullscreen"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="15 3 21 3 21 9" />
                              <polyline points="9 21 3 21 3 15" />
                              <line x1="21" y1="3" x2="14" y2="10" />
                              <line x1="3" y1="21" x2="10" y2="14" />
                            </svg>
                            Fullscreen
                          </button>
                          <button
                            className={styles.recordingAction}
                            onClick={() => handleDownloadRecording(pres.id, pres.speakerName || pres.fileName)}
                            title="Download WebM"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            WebM
                          </button>
                          <button
                            className={styles.recordingAction}
                            onClick={() => handleDownloadMp4(pres.id, pres.speakerName || pres.fileName)}
                            disabled={convertingMp4 === pres.id}
                            title="Download MP4 (converts via FFmpeg)"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            {convertingMp4 === pres.id ? 'Converting...' : 'MP4'}
                          </button>
                          <button
                            className={`${styles.recordingAction} ${styles.recordingActionDanger}`}
                            onClick={() => handleDeleteRecording(pres.id)}
                            title="Delete recording"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className={styles.presDelete}
                    onClick={() => handleDeletePres(pres.id)}
                    aria-label="Delete presentation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            {...pdfDropzone.getRootProps()}
            className={`${styles.dropzone} ${pdfLoading ? styles.dropzoneLoading : ''}`}
          >
            <input {...pdfDropzone.getInputProps()} />
            {pdfLoading ? (
              <div className={styles.pdfLoadingBar}>
                <div className={styles.pdfLoadingFill} style={{ width: `${(pdfProgress / 20) * 100}%` }} />
                <span>Validating slide {pdfProgress} of 20...</span>
              </div>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add story (PDF, 20 slides, max 30 MB)</span>
              </>
            )}
          </div>

          {pdfError && (
            <div className={styles.error}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              {pdfError}
            </div>
          )}
        </section>
      </div>

      <div className={styles.bottomActions}>
        <button className={styles.saveButton} onClick={onBack}>
          Save
        </button>
      </div>
    </div>
  );
}
