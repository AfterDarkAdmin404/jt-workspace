import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUsersTable1794989500000 implements MigrationInterface {
  name = 'CreateUsersTable1794989500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'username',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'googleId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'facebookId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'provider',
            type: 'varchar',
            isNullable: false,
            default: `'local'`,
          },
          {
            name: 'avatarUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('users', [
      new TableIndex({
        name: 'IDX_USERS_EMAIL_UNIQUE',
        columnNames: ['email'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_USERS_USERNAME_UNIQUE',
        columnNames: ['username'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_USERS_GOOGLE_ID_UNIQUE',
        columnNames: ['googleId'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_USERS_FACEBOOK_ID_UNIQUE',
        columnNames: ['facebookId'],
        isUnique: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'IDX_USERS_FACEBOOK_ID_UNIQUE');
    await queryRunner.dropIndex('users', 'IDX_USERS_GOOGLE_ID_UNIQUE');
    await queryRunner.dropIndex('users', 'IDX_USERS_USERNAME_UNIQUE');
    await queryRunner.dropIndex('users', 'IDX_USERS_EMAIL_UNIQUE');
    await queryRunner.dropTable('users', true);
  }
}

export const SHARED_MIGRATIONS = [CreateUsersTable1794989500000];
