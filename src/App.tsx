import { useState, useCallback } from 'react';
import type { AppScreen } from './types';
import { EventsListScreen } from './components/EventsListScreen';
import { EventSetupScreen } from './components/EventSetupScreen';
import { EventRunScreen } from './components/EventRunScreen';
import styles from './App.module.css';

function App() {
  const [screen, setScreen] = useState<AppScreen>('events-list');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

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
  }, []);

  const handleRunEvent = useCallback((id: string) => {
    setActiveEventId(id);
    setScreen('event-run');
  }, []);

  const handleExitRun = useCallback(() => {
    setScreen('event-setup');
  }, []);

  return (
    <div className={styles.app}>
      {screen === 'events-list' && (
        <EventsListScreen
          onSelectEvent={handleSelectEvent}
          onCreateEvent={handleCreateEvent}
          onRunEvent={handleRunEvent}
        />
      )}
      {screen === 'event-setup' && activeEventId && (
        <EventSetupScreen
          eventId={activeEventId}
          onBack={handleBackToList}
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
