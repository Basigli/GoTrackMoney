'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageContext';
import styles from './Navbar.module.css';

export default function Navbar({ username, onLogout, isAdmin }: { username: string, onLogout: () => void, isAdmin?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className={styles.bar} aria-label="Main navigation">
      <div className={styles.header}>
        <div className={styles.brand}>GoTrackMoney</div>
        <button className={styles.menuButton} type="button" aria-label={t(isOpen ? 'nav.close_menu' : 'nav.open_menu')} aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className={`${styles.content} ${isOpen ? styles.open : ''}`}>
        <div className={styles.links}>
          <Link href="/" className={`${styles.link} ${pathname === '/' ? styles.active : ''}`}>{t('nav.dashboard')}</Link>
          <Link href="/categories" className={`${styles.link} ${pathname === '/categories' ? styles.active : ''}`}>{t('nav.categories')}</Link>
          <Link href="/periodic" className={`${styles.link} ${pathname === '/periodic' ? styles.active : ''}`}>{t('record.periodic') || 'Periodic'}</Link>
          <Link href="/search" className={`${styles.link} ${pathname === '/search' ? styles.active : ''}`}>{t('nav.search')}</Link>
          <Link href="/analytics" className={`${styles.link} ${pathname === '/analytics' ? styles.active : ''}`}>{t('nav.analytics')}</Link>
          {isAdmin && <Link href="/admin" className={`${styles.link} ${pathname === '/admin' ? styles.active : ''}`}>{t('nav.admin')}</Link>}
        </div>
        <div className={styles.right}>
          <Link href="/profile" className={styles.profileLink} title={username}><span className={styles.profileName}>{username}</span></Link>
          <button type="button" onClick={onLogout} className={styles.logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </nav>
  );
}
