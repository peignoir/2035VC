import { useCallback, useState, useEffect } from 'react';
import type { ShareableEvent } from '../types';
import { getLogoBlob } from '../lib/db';
import { generateLogo } from '../lib/generateLogo';
import styles from './EventLandingScreen.module.css';

interface EventLandingScreenProps {
  event: ShareableEvent;
  logoUrl?: string | null;
}

export function EventLandingScreen({ event, logoUrl: externalLogoUrl }: EventLandingScreenProps) {
  const shortDate = formatShortDate(event.date);
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (externalLogoUrl || event.logo) return;
    let revoke = '';
    (async () => {
      try {
        let blob: Blob | null | undefined = null;
        if (event.eventId) {
          blob = await getLogoBlob(event.eventId);
        }
        if (!blob) {
          blob = await generateLogo(event.name, event.city);
        }
        const url = URL.createObjectURL(blob);
        revoke = url;
        setResolvedLogoUrl(url);
      } catch { /* fall through to text fallback */ }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [externalLogoUrl, event.logo, event.eventId, event.name, event.city]);

  const logoUrl = externalLogoUrl || event.logo || resolvedLogoUrl;

  const scrollToReserve = useCallback(() => {
    if (event.link) {
      window.open(event.link, '_blank', 'noopener');
    }
  }, [event.link]);

  return (
    <div className={styles.page}>
      {/* Top nav */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <span className={styles.navBrand}>Cafe2035</span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.navLink} onClick={() => document.getElementById('what')?.scrollIntoView({ behavior: 'smooth' })}>What is this</button>
          <button className={styles.navLink} onClick={() => document.getElementById('speakers')?.scrollIntoView({ behavior: 'smooth' })}>Stories</button>
          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className={styles.navCta}>
              I'm in
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <div className={styles.chips}>
              {event.city && <span className={styles.chip}>{event.city}</span>}
              {shortDate && <span className={styles.chip}>{shortDate}</span>}
            </div>
            <h1 className={styles.headline}>
              See <span className={styles.accent}>2035</span> before it arrives.
            </h1>
            <p className={styles.subhead}>
              Tonight we open a window into 2035. A world where AI and robots have reshaped how we work, learn, create, and live. Not a prediction. Not a trend report. <span className={styles.accent}>A vision.</span> The future made visible, right in front of you.
            </p>
            <div className={styles.ctaRow}>
              {event.link && (
                <a href={event.link} target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>
                  Reserve a seat
                </a>
              )}
              <button className={styles.ctaSecondary} onClick={() => document.getElementById('speakers')?.scrollIntoView({ behavior: 'smooth' })}>
                See the lineup
              </button>
            </div>
          </div>
          <div className={styles.heroRight}>
            {logoUrl ? (
              <>
                <img src={logoUrl} alt={event.name} className={styles.heroLogo} />
                {event.name && <p className={styles.heroChapterName}>{event.name}</p>}
              </>
            ) : (
              <div className={styles.heroLogoFallback}>
                <span className={styles.heroLogoText}>{event.name || 'Cafe2035'}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What is Cafe2035 */}
      <section id="what" className={styles.whatSection}>
        <div className={styles.whatContent}>
          <h2 className={styles.whatHeadline}>An AI prepper meetup.</h2>
          <p className={styles.whatBody}>
            Cafe2035 is a worldwide gathering of people who refuse to be caught off guard by AI and want to see 2035 before it arrives. Over morning coffee or late-night drinks, in cities across the globe.
          </p>
          <p className={styles.whatPunch}>
            Whatever is coming, you'll be ready <span className={styles.accent}>(and sleep better)</span>.
          </p>
        </div>
      </section>

      {/* What you'll walk away with */}
      <section className={styles.valueSection}>
        <h2 className={styles.sectionTitle}>What you'll walk away with</h2>
        <div className={styles.valueGrid}>
          <div className={styles.valueCard}>
            <span className={styles.valueEmoji}>&#x1F52D;</span>
            <h3 className={styles.valueTitle}>Clarity</h3>
            <p className={styles.valueDesc}>
              Complex trends distilled into 5-minute stories you can act on Monday morning.
            </p>
          </div>
          <div className={styles.valueCard}>
            <span className={styles.valueEmoji}>&#x26A1;</span>
            <h3 className={styles.valueTitle}>Energy</h3>
            <p className={styles.valueDesc}>
              Fast-paced, no filler. Every speaker has exactly 5 minutes to change how you think.
            </p>
          </div>
          <div className={styles.valueCard}>
            <span className={styles.valueEmoji}>&#x1F91D;</span>
            <h3 className={styles.valueTitle}>People</h3>
            <p className={styles.valueDesc}>
              Builders, founders, and dreamers in one room. The conversations after are as good as the talks.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.howSection}>
        <h2 className={styles.sectionTitle}>The format</h2>
        <p className={styles.howLine}>
          Each speaker tells a story from 2035. <strong>20 slides, auto-advancing every 15 seconds.</strong> No rambling, no fluff. Optimistic or dystopian — you decide what to believe.
        </p>
        <span className={styles.formatBadge}>20 x 15s</span>
        <p className={styles.howSubline}>Stories, not panels.</p>
      </section>

      {/* Speaker Lineup */}
      {event.presentations.length > 0 && (
        <section id="speakers" className={styles.speakersSection}>
          <h2 className={styles.sectionTitle}>Tonight's stories</h2>
          <div className={styles.speakerGrid}>
            {event.presentations.map((pres, index) => {
              const isDystopian = pres.storyTone === 'dystopian' || pres.storyTone === 'black';
              const toneEmoji = isDystopian ? '\uD83C\uDF11' : '\u2600\uFE0F';
              const toneLabel = isDystopian ? 'Dystopian' : 'Optimistic';
              return (
                <div key={index} className={styles.speakerCard}>
                  <div className={styles.speakerHeader}>
                    <h3 className={styles.storyTitle}>{pres.storyName || 'Untitled Story'}</h3>
                    <span className={styles.toneBadge} title={toneLabel}>{toneEmoji} {toneLabel}</span>
                  </div>
                  <p className={styles.speakerName}>{pres.speakerName || 'TBA'}</p>
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
                  {pres.recording && (
                    <video
                      className={styles.recordingVideo}
                      src={pres.recording}
                      controls
                      preload="metadata"
                      playsInline
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      {event.link && (
        <section className={styles.bottomCta}>
          <h2 className={styles.bottomCtaHeadline}>Ready to see what's coming?</h2>
          <a href={event.link} target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>
            Reserve a seat
          </a>
        </section>
      )}

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerBrand}>Cafe2035</span>
        <span className={styles.footerTagline}>See the future. Sleep better.</span>
      </footer>

      {/* Mobile sticky CTA */}
      {event.link && (
        <div className={styles.mobileStickyBar}>
          <button className={styles.mobileStickyButton} onClick={scrollToReserve}>
            I'm in
          </button>
        </div>
      )}
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
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
