import type { ShareableEvent } from '../types';
import styles from './EventLandingScreen.module.css';

interface EventLandingScreenProps {
  event: ShareableEvent;
  onBack?: () => void;
}

export function EventLandingScreen({ event, onBack }: EventLandingScreenProps) {
  const formattedDate = formatDate(event.date);

  return (
    <div className={styles.container}>
      {onBack && (
        <nav className={styles.nav}>
          <button className={styles.backButton} onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        </nav>
      )}
      <header className={styles.hero}>
        <h1 className={styles.eventName}>{event.name || 'Cafe 2035'}</h1>
        <div className={styles.eventMeta}>
          {event.city && <span>{event.city}</span>}
          {event.city && formattedDate && <span className={styles.metaDot}>&middot;</span>}
          {formattedDate && <span>{formattedDate}</span>}
        </div>
        <p className={styles.tagline}>The future is in this room</p>
      </header>

      <section className={styles.formatSection}>
        <h2 className={styles.sectionTitle}>What is a fast PechaKucha?</h2>
        <div className={styles.formatGrid}>
          <div className={styles.formatCard}>
            <span className={styles.formatNumber}>20</span>
            <span className={styles.formatLabel}>slides</span>
          </div>
          <div className={styles.formatCard}>
            <span className={styles.formatNumber}>15s</span>
            <span className={styles.formatLabel}>per slide</span>
          </div>
          <div className={styles.formatCard}>
            <span className={styles.formatNumber}>5</span>
            <span className={styles.formatLabel}>min of storytelling</span>
          </div>
        </div>
        <p className={styles.formatDescription}>
          Meet the Jules Verne of our time. Get inspired by solo founders powered by AI,
          building the future one story at a time. A builders community where the spirit
          is to dream boldly and create fearlessly.
        </p>
      </section>

      {event.presentations.length > 0 && (
        <section className={styles.speakersSection}>
          <h2 className={styles.sectionTitle}>Speaker Lineup</h2>
          <div className={styles.speakerGrid}>
            {event.presentations.map((pres, index) => {
              const toneEmoji = pres.storyTone === 'white' ? '\u2764\uFE0F' : pres.storyTone === 'black' ? '\uD83D\uDCA9' : '\u2696\uFE0F';
              const toneLabel = pres.storyTone === 'white' ? 'Bloom' : pres.storyTone === 'black' ? 'Doom' : 'Balance';
              return (
                <div key={index} className={styles.speakerCard}>
                  <div className={styles.speakerHeader}>
                    <h3 className={styles.speakerName}>{pres.speakerName || 'TBA'}</h3>
                    <span className={styles.toneBadge} title={toneLabel}>{toneEmoji} {toneLabel}</span>
                  </div>
                  {pres.storyName && (
                    <p className={styles.storyTitle}>{pres.storyName}</p>
                  )}
                  {pres.speakerBio && (
                    <p className={styles.speakerBio}>{pres.speakerBio}</p>
                  )}
                  {(pres.socialX || pres.socialInstagram || pres.socialLinkedin) && (
                    <div className={styles.socialLinks}>
                      {pres.socialX && (
                        <a href={normalizeUrl(pres.socialX, 'x')} target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="X">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        </a>
                      )}
                      {pres.socialInstagram && (
                        <a href={normalizeUrl(pres.socialInstagram, 'instagram')} target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="Instagram">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="5" />
                            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                          </svg>
                        </a>
                      )}
                      {pres.socialLinkedin && (
                        <a href={normalizeUrl(pres.socialLinkedin, 'linkedin')} target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="LinkedIn">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {event.link && (
        <section className={styles.ctaSection}>
          <a href={event.link} target="_blank" rel="noopener noreferrer" className={styles.ctaButton}>
            Get your ticket
          </a>
        </section>
      )}

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>2035.VC</span>
      </footer>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function normalizeUrl(input: string, platform: 'x' | 'instagram' | 'linkedin'): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const handle = trimmed.replace(/^@/, '');
  switch (platform) {
    case 'x': return `https://x.com/${handle}`;
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'linkedin': return trimmed.includes('/') ? `https://linkedin.com/${trimmed}` : `https://linkedin.com/in/${handle}`;
  }
}
