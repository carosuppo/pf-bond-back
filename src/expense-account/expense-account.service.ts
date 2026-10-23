import { Inject, Injectable } from '@nestjs/common';
import { CreateExpenseAccountDto } from './dto/create-expense-account.dto';
import { ExpenseAccountResponseDto } from './dto/expense-account-response.dto';
import type { CreateExpenseAccountData } from './interface/create-expense-account.interface';
import { ExpenseAccountMapper } from './mapper/expense-account.mapper';
import type { IExpenseAccountRepository } from './repository/expense-account.repository.interface';
import { ExpenseAccountValidator } from './validator/expense-account.validator';

@Injectable()
export class ExpenseAccountService {
  constructor(
    @Inject('expenseAccountRepository')
    private readonly expenseAccountRepository: IExpenseAccountRepository,
    @Inject('expenseAccountValidator')
    private readonly expenseAccountValidator: ExpenseAccountValidator,
  ) {}

  async createExpenseAccount(
    createExpenseAccountDto: CreateExpenseAccountDto,
    groupId: number,
    userId: number,
  ): Promise<ExpenseAccountResponseDto> {
    await this.expenseAccountValidator.existsGroup(groupId);
    const creator = await this.expenseAccountValidator.requireMembership(
      userId,
      groupId,
    );

    const memberIds = [
      ...new Set([creator.id, ...createExpenseAccountDto.memberIds]),
    ];

    await this.expenseAccountValidator.validateMembersBelongToGroup(
      memberIds,
      groupId,
    );

    if (createExpenseAccountDto.eventId != null) {
      await this.expenseAccountValidator.requireEventInGroup(
        createExpenseAccountDto.eventId,
        groupId,
      );
      await this.expenseAccountValidator.validateMembersBelongToEvent(
        memberIds,
        createExpenseAccountDto.eventId,
      );
    }

    const persistenceData: CreateExpenseAccountData =
      ExpenseAccountMapper.toCreatePersistence(
        createExpenseAccountDto,
        memberIds,
      );

    const createdExpenseAccount = await this.expenseAccountRepository.create(
      persistenceData,
      groupId,
      userId,
    );

    return ExpenseAccountMapper.toResponse(createdExpenseAccount);
  }
}
