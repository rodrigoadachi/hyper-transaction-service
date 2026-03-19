import { InMemoryUserRepository } from './in-memory-user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { HashedPasswordVO } from '../../domain/value-objects/hashed-password.vo';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';

function makeUser(email: string): UserEntity {
  return UserEntity.reconstitute(
    UuidVO.fromString('01945cf0-0000-7000-8000-000000000001'),
    EmailVO.create(email),
    HashedPasswordVO.fromHash('$2b$12$hash'),
    new Date(),
  );
}

describe('InMemoryUserRepository', () => {
  let repo: InMemoryUserRepository;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
  });

  it('should return null when user does not exist', async () => {
    const result = await repo.findByEmail(EmailVO.create('unknown@example.com'));
    expect(result).toBeNull();
  });

  it('should save and then find a user by email', async () => {
    const user = makeUser('alice@example.com');
    await repo.save(user);

    const found = await repo.findByEmail(EmailVO.create('alice@example.com'));
    expect(found).toBe(user);
  });

  it('should return false for existsByEmail when user not saved', async () => {
    const exists = await repo.existsByEmail(EmailVO.create('ghost@example.com'));
    expect(exists).toBe(false);
  });

  it('should return true for existsByEmail after saving user', async () => {
    const user = makeUser('bob@example.com');
    await repo.save(user);

    const exists = await repo.existsByEmail(EmailVO.create('bob@example.com'));
    expect(exists).toBe(true);
  });

  it('should overwrite user on duplicate email save', async () => {
    const user1 = makeUser('carol@example.com');
    const user2 = UserEntity.reconstitute(
      UuidVO.fromString('01945cf0-0000-7000-8000-000000000002'),
      EmailVO.create('carol@example.com'),
      HashedPasswordVO.fromHash('$2b$12$different'),
      new Date(),
    );

    await repo.save(user1);
    await repo.save(user2);

    const found = await repo.findByEmail(EmailVO.create('carol@example.com'));
    expect(found).toBe(user2);
  });
});
