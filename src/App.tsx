import { useState, useCallback, useEffect } from 'react';
import type { AppScreen, ShareableEvent } from './types';
import { parseShareUrl, parseSlug, buildSlug } from './lib/shareUrl';
import { putSharedEvent, getSharedEvent } from './lib/db';
import { EventsListScreen } from './components/EventsListScreen';
import { EventSetupScreen } from './components/EventSetupScreen';
import { EventRunScreen } from './components/EventRunScreen';
import { EventLandingScreen } from './components/EventLandingScreen';
import styles from './App.module.css';

const ADMIN_PASSWORD = 'pofpof';
const ADMIN_SESSION_KEY = 'admin_unlocked';

function App() {
  const [screen, setScreen] = useState<AppScreen>('events-list');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [sharedEvent, setSharedEvent] = useState<ShareableEvent | null>(null);
  const [landingLogoUrl, setLandingLogoUrl] = useState<string | null>(null);
  const [checkingHash, setCheckingHash] = useState(true);
  const [adminUnlocked, setAdminUnlocked] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handlePasswordSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      setPasswordInput('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  }, [passwordInput]);

  // On mount, check if the URL hash contains shared event data
  useEffect(() => {
    (async () => {
      const hash = window.location.hash;

      // 1. Full share URL with compressed data — decode, cache, clean URL
      const parsed = await parseShareUrl(hash);
      if (parsed) {
        const { event, slug } = parsed;
        setSharedEvent(event);
        setScreen('event-landing');
        // Cache for future clean-URL visits
        putSharedEvent(slug, event).catch(() => {});
        // Replace ugly URL with clean slug
        const cleanHash = `#/${slug}`;
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleanHash}`);
        setCheckingHash(false);
        return;
      }

      // 2. Clean slug URL — look up cached event
      const slug = parseSlug(hash);
      if (slug) {
        const cached = await getSharedEvent(slug);
        if (cached) {
          setSharedEvent(cached);
          setScreen('event-landing');
        } else {
          setSharedEvent(null);
          setScreen('event-not-found');
        }
        setCheckingHash(false);
        return;
      }

      // 3. No share URL — fall through to admin screens
      setCheckingHash(false);
    })();
  }, []);

  const handleCreateEvent = useCallback(() => {
    const id = crypto.randomUUID();
    setActiveEventId(id);
    setScreen('event-setup');
  }, []);

  const handleSelectEvent = useCallback((id: string) => {
    setActiveEventId(id);
    setScreen('event-setup');
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveEventId(null);
    setScreen('events-list');
    window.location.hash = '';
  }, []);

  const handleRunEvent = useCallback((id: string) => {
    setActiveEventId(id);
    setScreen('event-run');
  }, []);

  const handleExitRun = useCallback(() => {
    setScreen('event-setup');
  }, []);

  const handleOpenLanding = useCallback((event: ShareableEvent, logoUrl?: string) => {
    setSharedEvent(event);
    setLandingLogoUrl(logoUrl ?? null);
    setScreen('event-landing');
    // Cache event and set clean URL
    const slug = buildSlug(event.city, event.date);
    putSharedEvent(slug, event).catch(() => {});
    window.location.hash = `#/${slug}`;
  }, []);


  if (checkingHash) {
    return <div className={styles.app} />;
  }

  // Landing page is public, admin screens require password
  if (screen === 'event-landing' && sharedEvent) {
    return (
      <div className={styles.app}>
        <EventLandingScreen event={sharedEvent} logoUrl={landingLogoUrl} />
      </div>
    );
  }

  if (screen === 'event-not-found') {
    return (
      <div className={styles.app}>
        <div className={styles.passwordGate}>
          <h2 className={styles.passwordTitle}>Event not found</h2>
          <p style={{ color: '#999', textAlign: 'center' }}>
            This event link may have expired or hasn't been opened on this device yet.
          </p>
        </div>
      </div>
    );
  }

  if (!adminUnlocked) {
    return (
      <div className={styles.app}>
        <div className={styles.passwordGate}>
          <form className={styles.passwordForm} onSubmit={handlePasswordSubmit}>
            <h2 className={styles.passwordTitle}>Admin Access</h2>
            <input
              className={`${styles.passwordInput} ${passwordError ? styles.passwordInputError : ''}`}
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              placeholder="Password"
              autoFocus
            />
            <button className={styles.passwordButton} type="submit">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      {screen === 'events-list' && (
        <EventsListScreen
          onSelectEvent={handleSelectEvent}
          onCreateEvent={handleCreateEvent}
          onRunEvent={handleRunEvent}
          onOpenLanding={handleOpenLanding}
        />
      )}
      {screen === 'event-setup' && activeEventId && (
        <EventSetupScreen
          eventId={activeEventId}
          onBack={handleBackToList}
          onOpenLanding={handleOpenLanding}
        />
      )}
      {screen === 'event-run' && activeEventId && (
        <EventRunScreen
          eventId={activeEventId}
          onExit={handleExitRun}
        />
      )}
    </div>
  );
}

export default App;
