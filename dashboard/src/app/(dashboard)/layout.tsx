import Link from 'next/link';
import type { ReactNode } from 'react';
import { Home, Settings, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-muted/30 md:block">
        <div className="p-6">
          <h1 className="text-xl font-bold">football-pipeline</h1>
        </div>
        <nav className="space-y-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  );
}
