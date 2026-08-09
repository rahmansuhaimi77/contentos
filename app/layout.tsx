import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ContentOS',
  description: 'AI marketing operating system',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
