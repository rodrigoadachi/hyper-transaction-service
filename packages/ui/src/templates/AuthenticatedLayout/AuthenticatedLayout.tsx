import { Button } from '@hyper/ui';
import type * as React from 'react';
import { cn } from '../../lib/utils';

export interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  className?: string;
  handleLogout?: () => void;
  handleNavigation?: (href: string) => void;
  itemSidebar?: {
    label: string;
    href: string;
    enabled?: boolean;
  }[];
}

export const AuthenticatedLayout = ({
  children,
  className,
  handleLogout,
  handleNavigation,
  itemSidebar,
}: AuthenticatedLayoutProps) => (
  <main
    className={cn(
      'inline-flex min-h-screen min-w-screen max-h-screen max-w-screen items-center justify-center overflow-hidden bg-background',
      className,
    )}
  >
    <div className="h-screen w-60 border-r border-zinc-400 justify-between flex-col items-center p-2 md:p-4 hidden md:flex">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-zinc-100 text-2xl font-bold mb-4">Hyper Finance</h1>
        {itemSidebar?.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={(event) => {
              if (!handleNavigation || item.enabled === false) return;
              event.preventDefault();
              handleNavigation(item.href);
            }}
            className={cn(
              'text-zinc-100 w-full hover:bg-zinc-600 px-4 py-2 rounded-md text-left',
              !item.enabled && 'opacity-50 pointer-events-none',
            )}
          >
            {item.label}
          </a>
        ))}
      </div>
      {!!handleLogout && (
        <Button label="Sair" variant="outline" onClick={handleLogout} className="w-full" />
      )}
    </div>
    <div className="w-full h-full flex-1 border p-2 md:p-4">{children}</div>
  </main>
);
