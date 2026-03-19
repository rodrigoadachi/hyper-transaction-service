import { createFileRoute } from '@tanstack/react-router';
import { RegisterView } from '../../../features/auth-register/view';

export const Route = createFileRoute('/_auth/register/')({ component: RegisterView });