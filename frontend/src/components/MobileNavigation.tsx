'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageContext';
import SafeDialog from './SafeDialog';
import styles from './MobileNavigation.module.css';

const icons = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h5v-7h4v7h5V9" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  analytics: <><path d="M4 3v18h17M9 17v-5m5 5V8m5 9V4" /></>,
  recurring: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  categories: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  admin: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  logout: <><path d="M9 3H4v18h5m6-14 5 5-5 5m-6-5h11" /></>,
};

function NavigationIcon({ name }: { name: keyof typeof icons }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}

export default function MobileNavigation({ username, onLogout, isAdmin }: { username: string; onLogout: () => void; isAdmin?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = ['/categories', '/profile', '/admin'].includes(pathname);
  const tabs = [
    { href: '/', label: 'nav.home', icon: 'home' },
    { href: '/search', label: 'nav.search', icon: 'search' },
    { href: '/analytics', label: 'nav.analytics', icon: 'analytics' },
    { href: '/periodic', label: 'nav.recurring', icon: 'recurring' },
  ] as const;

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMoreOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return <>
    <nav className={styles.bar} aria-label={t('nav.main_navigation')}>
      <div className={styles.tabs}>
        {tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? 'page' : undefined} className={`${styles.tab} ${pathname === tab.href ? styles.active : ''}`}>
          <NavigationIcon name={tab.icon} />
          <span>{t(tab.label)}</span>
        </Link>)}
        <button type="button" className={`${styles.tab} ${moreActive || moreOpen ? styles.active : ''}`} aria-current={moreActive ? 'true' : undefined} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
          <NavigationIcon name="more" />
          <span>{t('nav.more')}</span>
        </button>
      </div>
    </nav>
    {moreOpen && <SafeDialog title={t('nav.more')} onClose={() => setMoreOpen(false)} className={styles.moreDialog}>
      <nav className={styles.moreLinks} aria-label={t('nav.more_navigation')}>
        <Link href="/categories" className={styles.moreLink} aria-current={pathname === '/categories' ? 'page' : undefined} onClick={() => setMoreOpen(false)}>
          <NavigationIcon name="categories" /><span>{t('nav.categories')}</span>
        </Link>
        <Link href="/profile" className={styles.moreLink} aria-current={pathname === '/profile' ? 'page' : undefined} onClick={() => setMoreOpen(false)}>
          <NavigationIcon name="profile" /><span className={styles.account}><span>{t('auth.profile')}</span><span className={styles.username}>{username}</span></span>
        </Link>
        {isAdmin && <Link href="/admin" className={styles.moreLink} aria-current={pathname === '/admin' ? 'page' : undefined} onClick={() => setMoreOpen(false)}>
          <NavigationIcon name="admin" /><span>{t('nav.admin')}</span>
        </Link>}
        <button type="button" className={`${styles.moreLink} ${styles.logout}`} onClick={onLogout}>
          <NavigationIcon name="logout" /><span>{t('nav.logout')}</span>
        </button>
      </nav>
    </SafeDialog>}
  </>;
}
