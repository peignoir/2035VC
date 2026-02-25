// App navigation
export type AppScreen = 'events-list' | 'event-setup' | 'event-run';

// Event data model (persisted in IndexedDB)
export interface IgniteEvent {
  id: string;
  name: string;
  city: string;
  date: string;
  link: string;
  recordEnabled: boolean;
  createdAt: number;
}

export type StoryTone = 'white' | 'black' | 'neutral';

export interface EventPresentation {
  id: string;
  eventId: string;
  fileName: string;
  speakerName: string;
  storyName: string;
  storyTone: StoryTone;
  order: number;
}

// Presentation runtime types (in-memory only)
export interface SlideImage {
  pageNumber: number;
  objectUrl: string;
  width: number;
  height: number;
}

export interface LoadedDeck {
  fileName: string;
  slides: SlideImage[];
  aspectRatio: number;
}

export interface TimerState {
  currentSlide: number;
  slideElapsed: number;
  totalElapsed: number;
  isPaused: boolean;
  isFinished: boolean;
}
