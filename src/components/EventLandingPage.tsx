import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import type { ShareableEvent } from '../types';
import { putSharedEvent, getSharedEvent } from '../lib/db';
import { parseShareUrl } from '../lib/shareUrl';
import { EventLandingScreen } from './EventLandingScreen';
import styles from '../App.module.css';

interface LocationState {
  previewEvent?: ShareableEvent;
  logoUrl?: string;
}

export function EventLandingPage() {
  const { city, date } = useParams<{ city: string; date: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [event, setEvent] = useState<ShareableEvent | null>(state?.previewEvent ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(state?.logoUrl ?? null);
  const [loading, setLoading] = useState(!state?.previewEvent);
  const [notFound, setNotFound] = useState(false);

  // Check if date contains compressed data (e.g., "2026-02-27~KLUv...")
  const hasCompressedData = date?.includes('~') ?? false;
  const cleanDate = hasCompressedData ? date!.split('~')[0] : date;
  const slug = city && cleanDate ? `${city}/${cleanDate}` : null;

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Handle compressed data in URL (legacy format)
    if (hasCompressedData) {
      (async () => {
        const hash = `#/${city}/${date}`;
        const parsed = await parseShareUrl(hash);
        if (parsed) {
          putSharedEvent(slug, parsed.event).catch(() => {});
          setEvent(parsed.event);
          setLoading(false);
          // Clean the URL
          navigate(`/${slug}`, { replace: true });
        } else {
          setNotFound(true);
          setLoading(false);
        }
      })();
      return;
    }

    // If we have a preview event from navigation state, use it immediately
    if (state?.previewEvent) {
      // Strip blob URLs before caching
      const cacheSafe = {
        ...state.previewEvent,
        presentations: state.previewEvent.presentations.map(p => ({
          ...p,
          recording: p.recording?.startsWith('blob:') ? undefined : p.recording,
        })),
        logo: state.previewEvent.logo?.startsWith('blob:') ? undefined : state.previewEvent.logo,
      };
      putSharedEvent(slug, cacheSafe).catch(() => {});
      setLoading(false);
      return;
    }

    // Normal load: fetch static JSON first, fall back to IndexedDB cache
    let cancelled = false;
    (async () => {
      // Try fetching published static JSON (canonical source of truth)
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}events/${slug}.json`);
        if (resp.ok && !cancelled) {
          const fetched = await resp.json() as ShareableEvent;
          putSharedEvent(slug, fetched).catch(() => {});
          setEvent(fetched);
          setLogoUrl(null);
          setLoading(false);
          return;
        }
      } catch { /* network error, try cache */ }

      if (cancelled) return;

      // Fallback: IndexedDB cache
      const cached = await getSharedEvent(slug);
      if (cached && !cancelled) {
        setEvent(cached);
        setLogoUrl(null);
        setLoading(false);
        return;
      }

      if (!cancelled) {
        setNotFound(true);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className={styles.app} />;
  }

  if (notFound || !event) {
    return (
      <div className={styles.app}>
        <div className={styles.passwordGate}>
          <h2 className={styles.passwordTitle}>Event not found</h2>
          <p style={{ color: '#999', textAlign: 'center' }}>
            Ask the organizer for a share link to open this event on this device.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <EventLandingScreen event={event} logoUrl={logoUrl} />
    </div>
  );
}
