'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageContext';

export default function Navbar({ username, onLogout }: { username: string, onLogout: () => void }) {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
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
        </div>
        <div className="nav-right">
          <div className="lang-switcher" style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '16px', padding: '4px' }}>
            <button onClick={() => setLanguage('it')} style={{ padding: '4px 8px', border: 'none', background: language === 'it' ? 'var(--surface-color)' : 'transparent', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-color)', fontWeight: language === 'it' ? 'bold' : 'normal' }}>IT</button>
            <button onClick={() => setLanguage('en')} style={{ padding: '4px 8px', border: 'none', background: language === 'en' ? 'var(--surface-color)' : 'transparent', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-color)', fontWeight: language === 'en' ? 'bold' : 'normal' }}>EN</button>
          </div>
          <Link href="/profile" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 600 }}>{username}</Link>
          <button onClick={onLogout} className="logout-btn">{t('nav.logout')}</button>
        </div>
      </div>
    </div>
  );
}
