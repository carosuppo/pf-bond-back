import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ExpenseSplitType } from '@prisma/client';
import { CreateExpenseAccountDto } from './dto/create-expense-account.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseAccountDetailResponseDto } from './dto/expense-account-detail-response.dto';
import { ExpenseAccountResponseDto } from './dto/expense-account-response.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { MyExpenseAccountResponseDto } from './dto/my-expense-account-response.dto';
import { splitEqually } from './balance/expense-split.helper';
import type { CreateExpenseAccountData } from './interface/create-expense-account.interface';
import type { CreateExpenseData } from './interface/create-expense.interface';
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
    userId: number,
  ): Promise<ExpenseAccountResponseDto> {
    const groupId = createExpenseAccountDto.groupId;

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

  async getMyAccounts(userId: number): Promise<MyExpenseAccountResponseDto[]> {
    const accounts =
      await this.expenseAccountRepository.findAccountsByUserId(userId);

    return accounts.map((account) =>
      ExpenseAccountMapper.toMyAccountResponse(account),
    );
  }

  async getAccountDetail(
    accountId: number,
    userId: number,
  ): Promise<ExpenseAccountDetailResponseDto> {
    const { account, member } =
      await this.expenseAccountValidator.requireAccountMembership(
        accountId,
        userId,
      );

    return ExpenseAccountMapper.toDetailResponse(account, member.id);
  }

  async createExpense(
    createExpenseDto: CreateExpenseDto,
    accountId: number,
    userId: number,
  ): Promise<ExpenseResponseDto> {
    const { account } =
      await this.expenseAccountValidator.requireAccountMembership(
        accountId,
        userId,
      );

    const isEqualSplit = createExpenseDto.splitType === ExpenseSplitType.EQUAL;
    const participantIds = isEqualSplit
      ? [...new Set(createExpenseDto.participantIds ?? [])]
      : [
          ...new Set(
            (createExpenseDto.shares ?? []).map((share) => share.memberId),
          ),
        ];

    if (participantIds.length === 0) {
      throw new BadRequestException(
        'Debes indicar al menos un participante del gasto.',
      );
    }

    this.expenseAccountValidator.validateExpenseParticipants(
      account.memberIds,
      createExpenseDto.payerMemberId,
      participantIds,
    );

    const shares = isEqualSplit
      ? splitEqually(createExpenseDto.amountCents, participantIds)
      : (createExpenseDto.shares ?? []).map((share) => ({
          memberId: share.memberId,
          amountCents: share.amountCents,
        }));

    if (!isEqualSplit) {
      this.expenseAccountValidator.validateCustomSharesTotal(
        createExpenseDto.amountCents,
        shares,
      );
    }

    const persistenceData: CreateExpenseData = {
      title: createExpenseDto.title?.trim() || null,
      amountCents: createExpenseDto.amountCents,
      payerMemberId: createExpenseDto.payerMemberId,
      splitType: createExpenseDto.splitType,
      shares,
    };

    const createdExpense = await this.expenseAccountRepository.createExpense(
      persistenceData,
      accountId,
    );

    return ExpenseAccountMapper.toExpenseResponse(createdExpense);
  }
}
