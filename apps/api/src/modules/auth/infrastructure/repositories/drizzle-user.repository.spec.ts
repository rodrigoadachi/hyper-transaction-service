import { DrizzleUserRepository } from './drizzle-user.repository';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { UserEntity } from '../../domain/entities/user.entity';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';

const USER_ID = '01945cf0-0000-7000-8000-000000000001';

function makeUserRow() {
  return {
    id: USER_ID,
    tenantId: USER_ID,
    email: 'alice@example.com',
    hashedPassword: '$2b$12$hashed',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('DrizzleUserRepository', () => {
  describe('findByEmail', () => {
    it('should return UserEntity when user is found', async () => {
      const row = makeUserRow();
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([row]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleUserRepository(db);

      const result = await repo.findByEmail(EmailVO.create('alice@example.com'));

      expect(result).toBeInstanceOf(UserEntity);
      expect(result).not.toBeNull();
      expect(result?.id.toString()).toBe(USER_ID);
    });

    it('should return null when user is not found', async () => {
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleUserRepository(db);

      const result = await repo.findByEmail(EmailVO.create('unknown@example.com'));

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should insert user with onConflictDoNothing', async () => {
      const onConflictDoNothing = jest.fn().mockResolvedValue(undefined);
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({ onConflictDoNothing }),
        }),
      } as never;
      const repo = new DrizzleUserRepository(db);

      const user = UserEntity.reconstitute(
        UuidVO.fromString(USER_ID),
        EmailVO.create('alice@example.com'),
        { toString: () => '$2b$12$hashed' } as never,
        new Date(),
      );

      await repo.save(user);

      expect(onConflictDoNothing).toHaveBeenCalled();
    });
  });

  describe('existsByEmail', () => {
    it('should return true when user exists', async () => {
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ id: USER_ID }]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleUserRepository(db);

      const result = await repo.existsByEmail(EmailVO.create('alice@example.com'));

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleUserRepository(db);

      const result = await repo.existsByEmail(EmailVO.create('nobody@example.com'));

      expect(result).toBe(false);
    });
  });
});
