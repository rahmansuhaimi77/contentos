import Link from 'next/link';
import type { ReactNode } from 'react';

export default function WebsitesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }} aria-label="Website Studio">
        <Link href="/websites" style={{ textDecoration: 'none', border: '1px solid #dcd9d1', background: '#fffdf8', color: '#2d3e36', borderRadius: 999, padding: '8px 12px', fontSize: 11, fontWeight: 800 }}>Studio</Link>
        <Link href="/websites/research" style={{ textDecoration: 'none', border: '1px solid #dcd9d1', background: '#253d36', color: '#fff', borderRadius: 999, padding: '8px 12px', fontSize: 11, fontWeight: 800 }}>Research + Plan</Link>
      </nav>
      {children}
    </div>
  );
}
