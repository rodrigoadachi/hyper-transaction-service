export interface LoginData {
  accessToken: string;
  expiresIn: string;
}

export interface RegisterData {
  userId: string;
  email: string;
}

export interface TransactionEntry {
  id: string;
  transactionId: string;
  type: string;
  amountInCents: number;
  description: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  tenantId: string;
  amountInCents: number;
  currency: string;
  source: string;
  description: string | null;
  status: string;
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  entries?: TransactionEntry[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionsPage {
  data: Transaction[];
  meta: PaginationMeta;
}
