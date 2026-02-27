import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import styles from '../App.module.css';

const ADMIN_PASSWORD = 'pofpof';
const ADMIN_SESSION_KEY = 'admin_unlocked';

export function AdminGuard() {
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true',
  );
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

  return <Outlet />;
}
