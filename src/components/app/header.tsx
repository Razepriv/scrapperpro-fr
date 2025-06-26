"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScanSearch, Database, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
    { href: '/', label: 'Scrape', icon: ScanSearch },
    { href: '/database', label: 'Database', icon: Database },
    { href: '/history', label: 'History', icon: History },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-card/50 backdrop-blur-lg border-b sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <ScanSearch className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            PropScrapeAI
          </h1>
        </Link>
        <nav className="hidden md:flex items-center gap-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
