import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserActionLogsTable1794990000000 implements MigrationInterface {
  name = 'CreateUserActionLogsTable1794990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'user_action_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'app_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'ip_address',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_action_logs',
      new TableForeignKey({
        name: 'FK_user_action_logs_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'user_action_logs',
      new TableIndex({
        name: 'IDX_USER_ACTION_LOGS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'user_action_logs',
      new TableIndex({
        name: 'IDX_USER_ACTION_LOGS_ACTION',
        columnNames: ['action'],
      }),
    );

    await queryRunner.createIndex(
      'user_action_logs',
      new TableIndex({
        name: 'IDX_USER_ACTION_LOGS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'user_action_logs',
      'IDX_USER_ACTION_LOGS_CREATED_AT',
    );
    await queryRunner.dropIndex(
      'user_action_logs',
      'IDX_USER_ACTION_LOGS_ACTION',
    );
    await queryRunner.dropIndex(
      'user_action_logs',
      'IDX_USER_ACTION_LOGS_USER_ID',
    );
    await queryRunner.dropForeignKey(
      'user_action_logs',
      'FK_user_action_logs_user_id',
    );
    await queryRunner.dropTable('user_action_logs', true);
  }
}
