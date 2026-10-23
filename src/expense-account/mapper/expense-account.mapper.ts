import { CreateExpenseAccountDto } from '../dto/create-expense-account.dto';
import { ExpenseAccountResponseDto } from '../dto/expense-account-response.dto';
import { ExpenseAccountEntity } from '../entity/expense-account.entity';
import { CreateExpenseAccountData } from '../interface/create-expense-account.interface';

export class ExpenseAccountMapper {
  static toResponse(
    expenseAccount: ExpenseAccountEntity,
  ): ExpenseAccountResponseDto {
    return {
      id: expenseAccount.id,
      name: expenseAccount.name,
      groupId: expenseAccount.groupId,
      eventId: expenseAccount.eventId ?? null,
      memberIds: expenseAccount.memberIds,
    };
  }

  static toCreatePersistence(
    createExpenseAccountDto: CreateExpenseAccountDto,
    memberIds: number[],
  ): CreateExpenseAccountData {
    return {
      name: createExpenseAccountDto.name,
      eventId: createExpenseAccountDto.eventId ?? null,
      memberIds,
    };
  }
}
