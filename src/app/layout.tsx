import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScamSentinel | AI Fraud Detection',
  description: 'An industry-ready AI-powered platform designed to protect everyone, especially the elderly, from digital scams and fraud.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-glow"></div>
        {children}
      </body>
    </html>
  );
}
