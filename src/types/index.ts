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

export type StoryTone = 'optimistic' | 'dystopian';

export interface EventPresentation {
  id: string;
  eventId: string;
  fileName: string;
  speakerName: string;
  storyName: string;
  storyTone: StoryTone;
  order: number;
  speakerBio?: string;
  socialX?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
}

// Shareable event data (encoded in URL, no blobs)
export interface ShareablePresentation {
  speakerName: string;
  storyName: string;
  storyTone: string;
  speakerBio?: string;
  socialX?: string;
  socialInstagram?: string;
  socialLinkedin?: string;
  recording?: string;
}

export interface ShareableEvent {
  name: string;
  city: string;
  date: string;
  link: string;
  presentations: ShareablePresentation[];
  eventId?: string;
  logo?: string;
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
