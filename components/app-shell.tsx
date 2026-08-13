'use client';

// Deployment retry marker: 2026-08-10 19:21 MYT
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

type Brand = { id: string; name: string };

const primaryNav = [
  { href: '/overview', icon: '⌂', label: 'Overview' },
  { href: '/growth-calendar', icon: '◎', label: 'Strategy' },
  { href: '/calendar', icon: '▦', label: 'Calendar' },
  { href: '/create', icon: '✦', label: 'Create' },
  { href: '/review', icon: '✓', label: 'Review' },
  { href: '/publishing', icon: '↗', label: 'Publish' },
];

const secondaryNav = [
  { href: '/brand', icon: '◈', label: 'Brand' },
  { href: '/connections', icon: '⚙', label: 'Settings' },
];

const mobileNav = [
  { href: '/overview', icon: '⌂', label: 'Home' },
  { href: '/calendar', icon: '▦', label: 'Calendar' },
  { href: '/create', icon: '✦', label: 'Create' },
  { href: '/review', icon: '✓', label: 'Review' },
  { href: '/brand', icon: '•••', label: 'More' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load(currentUser: User | null) {
      if (!mounted) return;
      setUser(currentUser);
      if (!currentUser) {
        setBrands([]);
        setBrandId('');
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('contentos_brands')
        .select('id,name')
        .order('updated_at', { ascending: false });

      if (!mounted) return;
      const nextBrands = (data ?? []) as Brand[];
      setBrands(nextBrands);
      const saved = window.localStorage.getItem('contentos:selectedBrandId');
      const resolved = nextBrands.some((brand) => brand.id === saved) ? saved! : nextBrands[0]?.id || '';
      setBrandId(resolved);
      if (resolved) window.localStorage.setItem('contentos:selectedBrandId', resolved);
      setLoading(false);
    }

    supabase.auth.getUser().then(({ data }) => load(data.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => load(session?.user ?? null));

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  function changeBrand(nextBrandId: string) {
    setBrandId(nextBrandId);
    window.localStorage.setItem('contentos:selectedBrandId', nextBrandId);
    window.dispatchEvent(new CustomEvent('contentos:brand-change', { detail: { brandId: nextBrandId } }));
  }

  function active(href: string) {
    if (href === '/overview') return pathname === '/overview';
    if (href === '/brand') return ['/brand', '/knowledge', '/assets'].some((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (href === '/create') return ['/create', '/quick-create', '/storyboards'].some((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (href === '/calendar') return ['/calendar', '/planner'].some((route) => pathname === route || pathname.startsWith(`${route}/`));
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // Keep the old Studio usable as a fallback route. All new product routes use the shared shell.
  if (pathname === '/') return children;
  if (loading) return <div className="appBoot"><div className="logo">CO</div><span>Loading ContentOS…</span></div>;
  if (!user) return children;

  const selectedBrand = brands.find((brand) => brand.id === brandId);

  return (
    <div className="appFrame">
      <aside className="appSidebar">
        <div className="appSidebarTop">
          <Link href="/overview" className="appIdentity" aria-label="ContentOS overview">
            <span className="logo">CO</span>
            <span><b>ContentOS</b><small>Marketing operating system</small></span>
          </Link>

          <label className="appBrandSwitcher">
            <span>ACTIVE BRAND</span>
            <select value={brandId} onChange={(event) => changeBrand(event.target.value)}>
              {brands.length === 0 && <option value="">No brands yet</option>}
              {brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}
            </select>
          </label>

          <nav className="appNav" aria-label="Primary">
            {primaryNav.map((item) => (
              <Link className={active(item.href) ? 'active' : ''} href={item.href} key={item.href}>
                <span>{item.icon}</span><b>{item.label}</b>
              </Link>
            ))}
          </nav>
        </div>

        <div className="appSidebarBottom">
          <nav className="appNav appNavSecondary" aria-label="Secondary">
            {secondaryNav.map((item) => (
              <Link className={active(item.href) ? 'active' : ''} href={item.href} key={item.href}>
                <span>{item.icon}</span><b>{item.label}</b>
              </Link>
            ))}
          </nav>
          <div className="appAccount">
            <span>{selectedBrand?.name || 'ContentOS'}</span>
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </aside>

      <div className="appStage">
        <header className="appMobileHeader">
          <Link href="/overview" className="appMobileLogo"><span className="logo">CO</span><b>ContentOS</b></Link>
          <select value={brandId} onChange={(event) => changeBrand(event.target.value)} aria-label="Active brand">
            {brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}
          </select>
        </header>
        <main className="appMain">{children}</main>
      </div>

      <nav className="appBottomNav" aria-label="Mobile navigation">
        {mobileNav.map((item) => (
          <Link className={active(item.href) ? 'active' : ''} href={item.href} key={item.href}>
            <span>{item.icon}</span><small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
