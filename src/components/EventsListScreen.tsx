import { useState, useEffect, useCallback } from 'react';
import type { IgniteEvent, ShareableEvent } from '../types';
import { getAllEvents, deleteEvent, getLogoBlob, getEventPresentations } from '../lib/db';
import { generateLogo } from '../lib/generateLogo';
import { buildShareHash } from '../lib/shareUrl';
import styles from './EventsListScreen.module.css';

interface EventsListScreenProps {
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
  onRunEvent: (eventId: string) => void;
  onOpenLanding: (event: ShareableEvent, hash: string, logoUrl?: string) => void;
}

export function EventsListScreen({ onSelectEvent, onCreateEvent, onRunEvent, onOpenLanding }: EventsListScreenProps) {
  const [events, setEvents] = useState<IgniteEvent[]>([]);
  const [logoUrls, setLogoUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const allEvents = await getAllEvents();
    setEvents(allEvents);

    // Load logo thumbnails — generate one for events without an uploaded logo
    const urls = new Map<string, string>();
    for (const event of allEvents) {
      const blob = await getLogoBlob(event.id);
      if (blob) {
        urls.set(event.id, URL.createObjectURL(blob));
      } else {
        try {
          const generated = await generateLogo(event.name, event.city);
          urls.set(event.id, URL.createObjectURL(generated));
        } catch {
          // Fall through to placeholder icon
        }
      }
    }
    // Revoke old URLs
    logoUrls.forEach((url) => URL.revokeObjectURL(url));
    setLogoUrls(urls);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadEvents();
    return () => {
      logoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(async (e: React.MouseEvent, eventId: string, eventName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${eventName || 'Untitled Gathering'}"? This will remove all talks and data.`)) {
      return;
    }
    await deleteEvent(eventId);
    const url = logoUrls.get(eventId);
    if (url) URL.revokeObjectURL(url);
    loadEvents();
  }, [logoUrls, loadEvents]);

  const handleRun = useCallback((e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    onRunEvent(eventId);
  }, [onRunEvent]);

  const handleOpenPublicPage = useCallback(async (e: React.MouseEvent, ev: IgniteEvent) => {
    e.stopPropagation();
    const pres = await getEventPresentations(ev.id);
    const shareable: ShareableEvent = {
      name: ev.name,
      city: ev.city,
      date: ev.date,
      link: ev.link,
      presentations: pres.map((p) => ({
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
    // Create a fresh blob URL for the landing page — the list screen's
    // cleanup will revoke its own copy when it unmounts.
    const logoBlob = await getLogoBlob(ev.id);
    const freshLogoUrl = logoBlob ? URL.createObjectURL(logoBlob) : undefined;
    onOpenLanding(shareable, hash, freshLogoUrl);
  }, [onOpenLanding]);

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading events...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cafe 2035</h1>
        <p className={styles.subtitle}>A worldwide movement of builders, dreamers, and storytellers</p>
        <p className={styles.quote}>"How many things have been denied one day, only to become realities the next!" — Jules Verne</p>
      </header>

      {events.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className={styles.emptyText}>No gatherings yet</p>
          <button className={styles.createButton} onClick={onCreateEvent}>
            Open a window into 2035
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {events.map((event) => (
            <div
              key={event.id}
              className={styles.card}
              onClick={() => onSelectEvent(event.id)}
            >
              <div className={styles.cardLogo}>
                {logoUrls.has(event.id) ? (
                  <img src={logoUrls.get(event.id)} alt="" className={styles.logoImage} />
                ) : (
                  <div className={styles.logoPlaceholder}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <div className={styles.cardInfo}>
                <h3 className={styles.cardName}>{event.name || 'Untitled Gathering'}</h3>
                <div className={styles.cardMeta}>
                  {event.city && <span>{event.city}</span>}
                  {event.city && event.date && <span className={styles.metaDot}>&middot;</span>}
                  {event.date && <span>{formatDate(event.date)}</span>}
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.publicPageButton}
                  onClick={(e) => handleOpenPublicPage(e, event)}
                  title="Public Page"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Public Page
                </button>
                <button
                  className={styles.runCardButton}
                  onClick={(e) => handleRun(e, event.id)}
                  title="Go Live"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21" />
                  </svg>
                  Go Live
                </button>
              </div>
              <button
                className={styles.deleteButton}
                onClick={(e) => handleDelete(e, event.id, event.name)}
                aria-label="Delete event"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}

          <div className={styles.newCard} onClick={onCreateEvent}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Gathering</span>
          </div>
        </div>
      )}
    </div>
  );
}
