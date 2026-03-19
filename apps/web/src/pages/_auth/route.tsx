import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AuthLayout } from '@hyper/ui';

const AuthLayoutRoute = () => (
  <AuthLayout>
    <Outlet />
  </AuthLayout>
);

export const Route = createFileRoute('/_auth')({
  beforeLoad({ context }) {
    if (context.auth.isAuthenticated) throw redirect({ to: '/dashboard' });
  },
  component: AuthLayoutRoute,
});
