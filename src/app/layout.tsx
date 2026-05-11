import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GuardianNode AI | AI-Powered Fraud Detection',
  description:
    'An industry-ready AI-powered platform designed to protect everyone, especially the elderly, from digital scams, phishing, and online fraud.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-glow" />
        {children}
      </body>
    </html>
  );
}
