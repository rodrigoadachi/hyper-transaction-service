import { TransactionType } from './transaction-type.vo';

describe('TransactionType', () => {
  it('should have CREDIT value', () => {
    expect(TransactionType.CREDIT).toBe('CREDIT');
  });

  it('should have DEBIT value', () => {
    expect(TransactionType.DEBIT).toBe('DEBIT');
  });
});
