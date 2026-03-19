import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	FormField,
	Separator,
	StatusBadge,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@hyper/ui";
import {
	type ChangeEvent,
	type FormEvent,
	useCallback,
	useMemo,
	useOptimistic,
	useState,
	useTransition,
} from "react";
import { formatCurrency, formatDate } from "../../../utils";
import { useCreateTransactionMutate, useTransactionsQuery } from "../model/queries";
import type { CreateTransactionPayload, Transaction } from "../model/types";

const feeInCents = (amount: number): number => Math.round(amount * 0.1);

const TxRow = ({ tx }: { tx: Transaction }) => {
	const fee = feeInCents(tx.amountInCents);
	const net = tx.amountInCents - fee;
	const isOptimistic = tx.id.startsWith("opt-");
	return (
		<TableRow style={{ opacity: isOptimistic ? 0.6 : 1 }}>
			<TableCell className="font-mono text-xs text-muted-foreground">
				{isOptimistic ? "···" : tx.id.slice(0, 8)}&hellip;
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
				{tx.source}
			</TableCell>
			<TableCell className="text-muted-foreground hidden md:table-cell">
				{tx.description ?? "—"}
			</TableCell>
			<TableCell className="text-muted-foreground hidden lg:table-cell">
				{isOptimistic ? "—" : formatDate(tx.createdAt)}
			</TableCell>
		</TableRow>
	);
};

export const TransactionsView = () => {
	const [page, setPage] = useState(1);
	const [showForm, setShowForm] = useState(false);
	const [amountDigits, setAmountDigits] = useState("");
	const [description, setDescription] = useState("");
	const [isPending, startTransition] = useTransition();

	const { data, isLoading, error } = useTransactionsQuery(page);
	const mutation = useCreateTransactionMutate();

	const [optimisticTxs, addOptimisticTx] = useOptimistic(
		data?.data ?? [],
		(state: Transaction[], newTx: Transaction) => [newTx, ...state],
	);

	const formattedAmount = useMemo(
		() =>
			amountDigits
				? new Intl.NumberFormat("pt-BR", {
					style: "currency",
					currency: "BRL",
				}).format(Number(amountDigits) / 100)
				: "",
		[amountDigits],
	);

	const totalPages = useMemo(() => data?.meta.totalPages ?? 1, [data?.meta.totalPages]);

	const handleAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		setAmountDigits(e.target.value.replace(/\D/g, "").slice(0, 10));
	}, []);

	const handleDescriptionChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value),
		[],
	);

	const handleToggleForm = useCallback(() => setShowForm((v) => !v), []);

	const handleCancelForm = useCallback(() => setShowForm(false), []);

	const handlePrevPage = useCallback(
		() => setPage((p) => Math.max(1, p - 1)),
		[],
	);

	const handleNextPage = useCallback(
		() => setPage((p) => Math.min(totalPages, p + 1)),
		[totalPages],
	);

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			const payload: CreateTransactionPayload = {
				amountInCents: Number(amountDigits),
				description: description || undefined,
				source: "MANUAL",
			};
			const optimisticTx: Transaction = {
				id: `opt-${Date.now()}`,
				tenantId: "",
				amountInCents: Number(amountDigits),
				currency: "BRL",
				source: "MANUAL",
				description: description || null,
				status: "PENDING",
				externalRef: null,
				metadata: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				processedAt: null,
			};
			startTransition(async () => {
				addOptimisticTx(optimisticTx);
				await mutation.mutateAsync(payload);
				setAmountDigits("");
				setDescription("");
				setShowForm(false);
			});
		},
		[amountDigits, description, mutation, addOptimisticTx],
	);

	return (
		<div className="min-h-screen w-full p-6 overflow-y-auto">
			<div className="mx-auto max-w-5xl space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Transações</h1>
						<p className="text-sm text-muted-foreground mt-0.5">
							Gerencie e acompanhe suas movimentações
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Badge variant="outline" className="text-xs">
							Página {page} de {totalPages}
						</Badge>
						<Button
							label={showForm ? "Cancelar" : "Nova Transação"}
							variant={showForm ? "outline" : "default"}
							onClick={handleToggleForm}
						/>
					</div>
				</div>

				{showForm && (
					<Card className="gap-0 py-0">
						<CardHeader className="py-5">
							<CardTitle className="text-base">Nova Transação</CardTitle>
							<CardDescription>
								Preencha os dados para registrar uma nova movimentação
							</CardDescription>
						</CardHeader>
						<Separator />
						<CardContent className="py-5">
							<form onSubmit={handleSubmit} className="flex flex-col gap-4">
								{mutation.isError && (
									<Alert variant="destructive">
										<AlertDescription>
											{(mutation.error as Error).message}
										</AlertDescription>
									</Alert>
								)}
								<FormField
									id="amount"
									label="Valor"
									type="text"
									inputMode="numeric"
									value={formattedAmount}
									onChange={handleAmountChange}
									placeholder="R$ 0,00"
									required
								/>
								<FormField
									id="description"
									label="Descrição (opcional)"
									type="text"
									value={description}
									onChange={handleDescriptionChange}
									placeholder="Descrição da transação"
								/>
								<div className="flex justify-end gap-3 pt-1">
									<Button
										label="Cancelar"
										variant="outline"
										onClick={handleCancelForm}
									/>
									<Button
										label={isPending ? "Processando..." : "Criar Transação"}
										type="submit"
										disabled={isPending || !amountDigits}
									/>
								</div>
							</form>
						</CardContent>
					</Card>
				)}

				<Card className="gap-0 py-0">
					<CardHeader className="py-5">
						<CardTitle className="text-base">Histórico de transações</CardTitle>
						<CardDescription>
							{data?.meta
								? `${data.meta.total} transações registradas`
								: "Carregando informações..."}
						</CardDescription>
					</CardHeader>
					<Separator />
					<CardContent className="p-0">
						{isLoading && (
							<div className="p-8 text-center text-sm text-muted-foreground">
								Carregando transações...
							</div>
						)}
						{error && (
							<div className="p-6">
								<Alert variant="destructive">
									<AlertDescription>
										{(error as Error).message}
									</AlertDescription>
								</Alert>
							</div>
						)}
						{!isLoading && !error && (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Valor</TableHead>
										<TableHead>Taxa (10%)</TableHead>
										<TableHead>Líquido</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="hidden md:table-cell">
											Origem
										</TableHead>
										<TableHead className="hidden md:table-cell">
											Descrição
										</TableHead>
										<TableHead className="hidden lg:table-cell">Data</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{optimisticTxs.map((tx) => (
										<TxRow key={tx.id} tx={tx} />
									))}
									{optimisticTxs.length === 0 && (
										<TableRow>
											<TableCell
												colSpan={8}
												className="py-8 text-center text-muted-foreground"
											>
												Nenhuma transação encontrada.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						)}
					</CardContent>
					{data?.meta && (
						<>
							<Separator />
							<CardFooter className="py-3 flex items-center justify-between text-xs text-muted-foreground">
								<span>
									Página {data.meta.page} de {data.meta.totalPages || 1} &mdash;{" "}
									{data.meta.total} transações no total
								</span>
								<div className="flex gap-2">
									<Button
										label="Anterior"
										variant="outline"
										size="sm"
										disabled={page === 1}
										onClick={handlePrevPage}
									/>
									<Button
										label="Próxima"
										variant="outline"
										size="sm"
										disabled={page >= totalPages}
										onClick={handleNextPage}
									/>
								</div>
							</CardFooter>
						</>
					)}
				</Card>
			</div>
		</div>
	);
};
