import { Module } from '@nestjs/common';
import { IdempotencyModule } from '@nestjs/idempotency';
import { User } from '../entities/user.entity';


@Module({
  imports: [
    IdempotencyModule.forRoot({
      // Runs after guards, so req.user is set. Keys never collide across users.
      scope: (req: { user?: User }) => req.user?.id,
    }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class OrgNestLibModule { }
