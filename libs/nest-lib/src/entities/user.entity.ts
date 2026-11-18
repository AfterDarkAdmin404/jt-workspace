import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AuthProvider = 'local' | 'google' | 'facebook';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: false })
  email!: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  googleId!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  facebookId!: string | null;

  @Column({ type: 'varchar', default: 'local' })
  provider!: AuthProvider;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export const SHARED_ENTITIES = [User];
