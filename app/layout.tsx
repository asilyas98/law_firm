import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'First Chair',
  description: 'First Chair private legal AI workspace for chat, packets, exhibits, tasks, calendar, document filling, and attorney-reviewed drafting.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
