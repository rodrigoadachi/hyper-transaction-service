import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../../../shared/infrastructure/database/drizzle.provider';
import { usersTable } from '../../../../shared/infrastructure/database/schema';
import type { IUserRepository } from '../../application/ports/user-repository.port';
import { UserEntity } from '../../domain/entities/user.entity';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { HashedPasswordVO } from '../../domain/value-objects/hashed-password.vo';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';

@Injectable()
export class DrizzleUserRepository implements IUserRepository {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
  ) {}

  async findByEmail(email: EmailVO): Promise<UserEntity | null> {
    const [row] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.value))
      .limit(1);

    if (!row) return null;
    return this.toEntity(row);
  }

  async save(user: UserEntity): Promise<void> {
    await this.db
      .insert(usersTable)
      .values({
        id: user.id.toString(),
        tenantId: user.id.toString(),
        email: user.email.toString(),
        hashedPassword: user.hashedPassword.toString(),
        createdAt: user.createdAt,
      })
      .onConflictDoNothing();
  }

  async existsByEmail(email: EmailVO): Promise<boolean> {
    const [row] = await this.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.value))
      .limit(1);

    return row !== undefined;
  }

  private toEntity(row: typeof usersTable.$inferSelect): UserEntity {
    return UserEntity.reconstitute(
      UuidVO.fromString(row.id),
      EmailVO.create(row.email),
      HashedPasswordVO.fromHash(row.hashedPassword),
      row.createdAt,
    );
  }
}
