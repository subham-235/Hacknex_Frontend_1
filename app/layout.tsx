import type { Metadata } from 'next';
import './globals.css';
import './redesign.css';
export const metadata: Metadata = {
  metadataBase: new URL(
    'https://suraksha-safety-workspace.sarmisthaad.chatgpt.site',
  ),
  title: 'Suraksha | Your safety, connected.',
  description:
    'Your personal safety workspace for trusted contacts, audio SOS, community awareness, and agent follow-ups.',
  openGraph: {
    title: 'Suraksha',
    description: 'Your safety, connected.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
