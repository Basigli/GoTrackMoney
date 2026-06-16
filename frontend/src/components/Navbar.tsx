'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageContext';

export default function Navbar({ username, onLogout }: { username: string, onLogout: () => void }) {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="navbar">
      <div style={{ display: 'flex', gap: '16px' }}>
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>{t('nav.dashboard')}</Link>
        <Link href="/categories" className={`nav-link ${pathname === '/categories' ? 'active' : ''}`}>{t('nav.categories')}</Link>
      </div>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="lang-switcher" style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '16px', padding: '4px' }}>
          <button onClick={() => setLanguage('it')} style={{ padding: '4px 8px', border: 'none', background: language === 'it' ? 'var(--surface-color)' : 'transparent', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-color)', fontWeight: language === 'it' ? 'bold' : 'normal' }}>IT</button>
          <button onClick={() => setLanguage('en')} style={{ padding: '4px 8px', border: 'none', background: language === 'en' ? 'var(--surface-color)' : 'transparent', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-color)', fontWeight: language === 'en' ? 'bold' : 'normal' }}>EN</button>
        </div>
        <span style={{ color: '#94a3b8' }}>{username}</span>
        <button onClick={onLogout} className="logout-btn">{t('nav.logout')}</button>
      </div>
    </div>
  );
}
