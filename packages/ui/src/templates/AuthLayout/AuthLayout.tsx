import type * as React from 'react';
import { cn } from '../../lib/utils';

export interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const AuthLayout = ({ children, className }: AuthLayoutProps) => (
  <main
    className={cn(
      'flex min-h-screen w-full items-center justify-center bg-background p-6 md:p-10',
      className,
    )}
  >
    <div className="w-full max-w-sm">{children}</div>
  </main>
);
