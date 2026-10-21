'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageContext';
import styles from './Navbar.module.css';
import MobileNavigation from './MobileNavigation';

export default function Navbar({ username, onLogout, isAdmin }: { username: string, onLogout: () => void, isAdmin?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <>
      <nav className={styles.bar} aria-label={t('nav.main_navigation')}>
        <div className={styles.content}>
          <div className={styles.links}>
            <Link href="/" aria-current={pathname === '/' ? 'page' : undefined} className={`${styles.link} ${pathname === '/' ? styles.active : ''}`}>{t('nav.dashboard')}</Link>
            <Link href="/categories" aria-current={pathname === '/categories' ? 'page' : undefined} className={`${styles.link} ${pathname === '/categories' ? styles.active : ''}`}>{t('nav.categories')}</Link>
            <Link href="/periodic" aria-current={pathname === '/periodic' ? 'page' : undefined} className={`${styles.link} ${pathname === '/periodic' ? styles.active : ''}`}>{t('record.periodic')}</Link>
            <Link href="/search" aria-current={pathname === '/search' ? 'page' : undefined} className={`${styles.link} ${pathname === '/search' ? styles.active : ''}`}>{t('nav.search')}</Link>
            <Link href="/analytics" aria-current={pathname === '/analytics' ? 'page' : undefined} className={`${styles.link} ${pathname === '/analytics' ? styles.active : ''}`}>{t('nav.analytics')}</Link>
            {isAdmin && <Link href="/admin" aria-current={pathname === '/admin' ? 'page' : undefined} className={`${styles.link} ${pathname === '/admin' ? styles.active : ''}`}>{t('nav.admin')}</Link>}
          </div>
          <div className={styles.right}>
            <Link href="/profile" aria-current={pathname === '/profile' ? 'page' : undefined} className={styles.profileLink} title={username}><span className={styles.profileName}>{username}</span></Link>
            <button type="button" onClick={onLogout} className={styles.logout}>{t('nav.logout')}</button>
          </div>
        </div>
      </nav>
      <MobileNavigation username={username} onLogout={onLogout} isAdmin={isAdmin} />
    </>
  );
}
