import { createFileRoute } from '@tanstack/react-router';
import { LoginView } from '../../../features/auth-login/view';

export const Route = createFileRoute('/_auth/login/')({ component: LoginView });