import { useState, useCallback, useEffect } from 'react';
import type { AppScreen, ShareableEvent } from './types';
import { parseShareUrl } from './lib/shareUrl';
import { EventsListScreen } from './components/EventsListScreen';
import { EventSetupScreen } from './components/EventSetupScreen';
import { EventRunScreen } from './components/EventRunScreen';
import { EventLandingScreen } from './components/EventLandingScreen';
import styles from './App.module.css';

function App() {
  const [screen, setScreen] = useState<AppScreen>('events-list');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [sharedEvent, setSharedEvent] = useState<ShareableEvent | null>(null);
  const [checkingHash, setCheckingHash] = useState(true);

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

  const handleOpenLanding = useCallback((event: ShareableEvent, hash: string) => {
    setSharedEvent(event);
    setScreen('event-landing');
    window.location.hash = hash;
  }, []);

  const handleExitLanding = useCallback(() => {
    setSharedEvent(null);
    setScreen('events-list');
    window.location.hash = '';
  }, []);

  if (checkingHash) {
    return <div className={styles.app} />;
  }

  return (
    <div className={styles.app}>
      {screen === 'event-landing' && sharedEvent && (
        <EventLandingScreen event={sharedEvent} onBack={handleExitLanding} />
      )}
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
