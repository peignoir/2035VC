import { useState, useCallback, useEffect } from 'react';
import type { AppScreen, ShareableEvent } from './types';
import { parseShareUrl } from './lib/shareUrl';
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
      const event = await parseShareUrl(window.location.hash);
      if (event) {
        setSharedEvent(event);
        setScreen('event-landing');
      }
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

  const handleOpenLanding = useCallback((event: ShareableEvent, hash: string, logoUrl?: string) => {
    setSharedEvent(event);
    setLandingLogoUrl(logoUrl ?? null);
    setScreen('event-landing');
    window.location.hash = hash;
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
