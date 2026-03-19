import { createFileRoute } from '@tanstack/react-router';
import { TransactionsView } from '../../../features/transactions/view';

export const Route = createFileRoute('/_authenticated/transactions/')({ component: TransactionsView });
