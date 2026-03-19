import { useCallback } from 'react';
import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router';
import { AuthenticatedLayout } from '@hyper/ui';

const itemSidebar = [
  { label: 'Dashboard', href: '/dashboard', enabled: true },
  { label: 'Transactions', href: '/transactions', enabled: true },
];

const AuthenticatedLayoutRoute = () => {
  const { auth } = Route.useRouteContext();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    auth.logout();
    router.navigate({ to: '/login' });
  }, [auth, router]);

  const handleNavigation = useCallback(
    (href: string) => {
      router.navigate({ to: href as never });
    },
    [router],
  );

  return (
    <AuthenticatedLayout
      handleLogout={handleLogout}
      handleNavigation={handleNavigation}
      itemSidebar={itemSidebar}
    >
      <Outlet />
    </AuthenticatedLayout>
  );
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad({ context }) {
    if (!context.auth.isAuthenticated) throw redirect({ to: '/login' });
  },
  component: AuthenticatedLayoutRoute,
});
