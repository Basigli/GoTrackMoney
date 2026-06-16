'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar({ username, onLogout }: { username: string, onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <div className="navbar">
      <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Overview</Link>
      <Link href="/categories" className={`nav-link ${pathname === '/categories' ? 'active' : ''}`}>Categories</Link>
      <div className="nav-right">
        <span style={{ marginRight: '16px', color: '#94a3b8' }}>{username}</span>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>
    </div>
  );
}
