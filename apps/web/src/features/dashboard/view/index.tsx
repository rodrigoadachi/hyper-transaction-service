import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hyper/ui';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Auth } from '../../../lib/auth';
import { formatCurrency, formatDate } from '../../../utils';
import { useDashboardRecentQuery, useDashboardStatsQuery } from '../model/queries';

const auth = new Auth();

const getEmailFromToken = (token: string | null): string => {
  if (!token) return '';
  try {
    const payload = token.split('.')[1];
    if (!payload) return '';
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.email === 'string' ? decoded.email : '';
  } catch {
    return '';
  }
};

const StatCard = ({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) => (
  <Card>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
    </CardHeader>
    {description && (
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    )}
  </Card>
);

export const DashboardView = () => {
  const email = getEmailFromToken(auth.token);
  const { data: statsData, isLoading: statsLoading } = useDashboardStatsQuery();
  const { data: recentData, isLoading: recentLoading } = useDashboardRecentQuery();

  const isLoading = statsLoading || recentLoading;

  const { transactions, total, completed, failed, volume, avgTicket, approvalRate } = useMemo(() => {
    const transactions = statsData?.data ?? [];
    const total = statsData?.meta.total ?? 0;
    const completed = transactions.filter((tx) => tx.status === 'COMPLETED').length;
    const failed = transactions.filter((tx) => tx.status === 'FAILED').length;
    const volume = transactions.reduce((sum, tx) => sum + tx.amountInCents, 0);
    const avgTicket = transactions.length > 0 ? Math.round(volume / transactions.length) : 0;
    const approvalRate =
      transactions.length > 0 ? ((completed / transactions.length) * 100).toFixed(1) : '\u2014';
    return { transactions, total, completed, failed, volume, avgTicket, approvalRate };
  }, [statsData]);

  const recentTransactions = useMemo(() => recentData?.data ?? [], [recentData]);

  return (
    <div className="min-h-screen w-full p-6 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Bem-vindo, <strong className="text-zinc-700">{email}</strong>
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton list
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-3 w-24 rounded bg-zinc-200" />
                  <div className="h-7 w-16 rounded bg-zinc-200 mt-1" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              title="Total de transações"
              value={String(total)}
              description="registradas na plataforma"
            />
            <StatCard
              title="Volume movimentado"
              value={formatCurrency(volume)}
              description={`últimas ${transactions.length} transações`}
            />
            <StatCard
              title="Ticket médio"
              value={transactions.length > 0 ? formatCurrency(avgTicket) : '—'}
              description="valor médio por transação"
            />
            <StatCard
              title="Taxa de aprovação"
              value={`${approvalRate}%`}
              description={`${completed} concluídas · ${failed} falhas`}
            />
          </div>
        )}

        <Card className="gap-0 py-0">
          <CardHeader className="py-5">
            <CardTitle className="text-base">Transações recentes</CardTitle>
            <CardDescription>Últimas 5 movimentações da conta</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-8 text-center text-sm text-zinc-500">Carregando...</div>
            )}
            {!isLoading && recentTransactions.length === 0 && (
              <div className="p-8 text-center text-sm text-zinc-500">
                Nenhuma transação encontrada.
              </div>
            )}
            {!isLoading && recentTransactions.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Taxa (10%)</TableHead>
                    <TableHead>Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx) => {
                    const fee = Math.round(tx.amountInCents * 0.1);
                    const net = tx.amountInCents - fee;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {tx.id.slice(0, 8)}&hellip;
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(tx.amountInCents)}
                        </TableCell>
                        <TableCell className="text-red-600">{formatCurrency(fee)}</TableCell>
                        <TableCell className="font-medium text-green-700">
                          {formatCurrency(net)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={tx.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {recentTransactions.length > 0 && (
            <>
              <Separator />
              <CardFooter className="py-3 justify-end">
                <Button
                  label="Ver todas as transações →"
                  render={<Link to="/transactions" />}
                  variant="ghost"
                  size="sm"
                />
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
