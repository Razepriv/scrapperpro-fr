import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Header } from '@/components/app/header';

export const metadata: Metadata = {
  title: 'PropScrapeAI',
  description: 'Scrape property listings and enhance content with AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
         <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950">
            <Header />
            <main className="flex-1 container mx-auto p-4 sm:p-6 md:p-8">
              {children}
            </main>
            <footer className="text-center p-4 text-sm text-muted-foreground">
              PropScrapeAI &copy; {new Date().getFullYear()}
            </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
