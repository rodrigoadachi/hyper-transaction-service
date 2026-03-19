import { Inject, Injectable, Logger } from '@nestjs/common';
import { TRANSACTION_TOKENS } from '../../transactions.tokens';
import { NotFoundError } from '../../../../shared/domain/errors';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { ITransactionRepository } from '../ports/transaction-repository.port';
import type { ITransactionEntryRepository } from '../ports/transaction-entry-repository.port';
import type { TransactionEntity } from '../../domain/entities/transaction.entity';
import type { TransactionEntryEntity } from '../../domain/entities/transaction-entry.entity';

export interface GetTransactionInput {
  readonly id: string;
  readonly tenantId: string;
}

export interface GetTransactionOutput {
  readonly transaction: TransactionEntity;
  readonly entries: TransactionEntryEntity[];
}

@Injectable()
export class GetTransactionUseCase {
  private readonly logger = new Logger(GetTransactionUseCase.name);

  constructor(
    @Inject(TRANSACTION_TOKENS.TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(TRANSACTION_TOKENS.TRANSACTION_ENTRY_REPOSITORY)
    private readonly entryRepository: ITransactionEntryRepository,
  ) {}

  async execute(input: GetTransactionInput): Promise<GetTransactionOutput> {
    const start = Date.now();

    let id: UuidVO;
    try {
      id = UuidVO.fromString(input.id);
    } catch {
      throw new NotFoundError(`Transaction not found: "${input.id}"`);
    }

    const transaction = await this.transactionRepository.findById(id, input.tenantId);

    if (!transaction) {
      throw new NotFoundError(`Transaction not found: "${input.id}"`);
    }

    const entries = await this.entryRepository.findByTransactionId(id, input.tenantId);

    this.logger.log({
      event: 'transaction.fetched',
      transactionId: input.id,
      tenantId: input.tenantId,
      durationMs: Date.now() - start,
    });

    return { transaction, entries };
  }
}
