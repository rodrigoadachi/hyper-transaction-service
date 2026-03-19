export interface TransactionCompletedEvent {
  readonly transactionId: string;
  readonly tenantId: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly source: string;
}

export interface ITransactionEventPublisher {
  publishTransactionCompleted(event: TransactionCompletedEvent): Promise<void>;
}
