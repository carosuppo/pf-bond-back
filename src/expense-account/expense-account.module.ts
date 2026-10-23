import { Module } from '@nestjs/common';
import { GroupModule } from '../group/group.module';
import { MemberModule } from '../member/member.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { ExpenseAccountController } from './expense-account.controller';
import { ExpenseAccountService } from './expense-account.service';
import { ExpenseAccountPrismaRepository } from './repository/expense-account.prisma.repository';
import { ExpenseAccountValidator } from './validator/expense-account.validator';

@Module({
  imports: [MemberModule, GroupModule, UserModule],
  controllers: [ExpenseAccountController],
  providers: [
    ExpenseAccountService,
    PrismaService,
    {
      provide: 'expenseAccountValidator',
      useClass: ExpenseAccountValidator,
    },
    {
      provide: 'expenseAccountRepository',
      useClass: ExpenseAccountPrismaRepository,
    },
  ],
})
export class ExpenseAccountModule {}
