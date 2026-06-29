'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageContext';

export default function Navbar({ username, onLogout, isAdmin }: { username: string, onLogout: () => void, isAdmin?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="navbar">
      <div className="navbar-header">
        <div className="mobile-only" style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary-color)' }}>GoTrackMoney</div>
        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className={`navbar-content ${isOpen ? 'open' : ''}`}>
        <div className="nav-links">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>{t('nav.dashboard')}</Link>
          <Link href="/categories" className={`nav-link ${pathname === '/categories' ? 'active' : ''}`}>{t('nav.categories')}</Link>
          <Link href="/periodic" className={`nav-link ${pathname === '/periodic' ? 'active' : ''}`}>{t('record.periodic') || 'Periodic'}</Link>
          <Link href="/search" className={`nav-link ${pathname === '/search' ? 'active' : ''}`}>{t('nav.search')}</Link>
          <Link href="/analytics" className={`nav-link ${pathname === '/analytics' ? 'active' : ''}`}>{t('nav.analytics')}</Link>
          {isAdmin && <Link href="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}>{t('nav.admin')}</Link>}
        </div>
        <div className="nav-right">
          <Link href="/profile" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 600 }}>{username}</Link>
          <button onClick={onLogout} className="logout-btn">{t('nav.logout')}</button>
        </div>
      </div>
    </div>
  );
}
