'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) {
        router.replace('/overview');
        return;
      }
      setLoading(false);
    });

    return () => { mounted = false; };
  }, [router, supabase]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage('Enter your email and password.');
      return;
    }

    setLoading(true);
    setMessage('Signing in…');

    try {
      const signIn = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Sign-in is taking too long. Please check your connection and try again.')), 15000);
      });

      const { data, error } = await Promise.race([signIn, timeout]);
      if (error) throw error;
      if (!data.session) throw new Error('Sign-in did not create a session. Please try again.');

      setMessage('Signed in. Opening your workspace…');
      router.replace('/overview');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="authShell">
      <form className="authCard" onSubmit={submit}>
        <div className="logo">CO</div>
        <span className="eyebrow">CONTENTOS</span>
        <h1>Welcome back.</h1>
        <p>Sign in to open your ContentOS workspace.</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            disabled={loading}
            required
          />
        </label>

        <button className="generate" disabled={loading}>
          {loading ? 'Please wait…' : 'Sign in'}
        </button>

        {message && <div className="authMessage" role="status">{message}</div>}
      </form>
    </main>
  );
}
