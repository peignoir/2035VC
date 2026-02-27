import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { parseShareUrl } from '../lib/shareUrl';
import { putSharedEvent } from '../lib/db';
import styles from '../App.module.css';

/**
 * Handles legacy URL formats:
 *   #/live/slug~data
 *   #/event/data
 * Also handles the compressed-data format: #/city/date~data
 * (which React Router matches as /:city/:date with ~ in the date param)
 */
export function LegacyRedirect() {
  const location = useLocation();
  const [redirect, setRedirect] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      // Reconstruct the original hash from the router path
      const hash = `#${location.pathname}`;
      const parsed = await parseShareUrl(hash);
      if (parsed) {
        const { event, slug } = parsed;
        putSharedEvent(slug, event).catch(() => {});
        setRedirect(`/${slug}`);
        return;
      }
      setNotFound(true);
    })();
  }, [location.pathname]);

  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  if (notFound) {
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

  return <div className={styles.app} />;
}
