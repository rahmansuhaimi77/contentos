import Link from 'next/link';
import type { ReactNode } from 'react';

const linkStyle = {
  textDecoration: 'none',
  border: '1px solid #dcd9d1',
  background: '#fffdf8',
  color: '#2d3e36',
  borderRadius: 999,
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 800,
} as const;

export default function WebsitesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }} aria-label="Website Studio">
        <Link href="/websites" style={linkStyle}>Brief + Projects</Link>
        <Link href="/websites/templates" style={linkStyle}>Template Library</Link>
        <Link href="/websites/build" style={linkStyle}>Adapt + Build</Link>
        <Link href="/websites/qa" style={linkStyle}>Preview + QA</Link>
        <Link href="/websites/release" style={linkStyle}>Release</Link>
      </nav>
      {children}
    </div>
  );
}
