import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ExpenseSplitType } from '@prisma/client';
import { CreateExpenseAccountDto } from './dto/create-expense-account.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseAccountDetailResponseDto } from './dto/expense-account-detail-response.dto';
import { ExpenseAccountResponseDto } from './dto/expense-account-response.dto';
import { ExpensePaymentResponseDto } from './dto/expense-payment-response.dto';
import { ExpenseResponseDto } from './dto/expense-response.dto';
import { MyExpenseAccountResponseDto } from './dto/my-expense-account-response.dto';
import { PendingExpenseShareResponseDto } from './dto/pending-expense-share-response.dto';
import { PendingExpenseAdjustmentResponseDto } from './dto/pending-expense-adjustment-response.dto';
import { RegisterExpensePaymentsDto } from './dto/register-expense-payments.dto';
import { UpdateExpenseAccountDto } from './dto/update-expense-account.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { splitEqually } from './balance/expense-split.helper';
import type { CreateExpenseAccountData } from './interface/create-expense-account.interface';
import type { CreateExpenseData } from './interface/create-expense.interface';
import type { UpdateExpenseAccountData } from './interface/update-expense-account.interface';
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

  async updateExpenseAccount(
    accountId: number,
    dto: UpdateExpenseAccountDto,
    userId: number,
  ): Promise<ExpenseAccountResponseDto> {
    if (dto.groupId !== undefined) {
      throw new BadRequestException(
        'No se puede cambiar el grupo de la cuenta.',
      );
    }

    if (
      dto.name === undefined &&
      dto.memberIds === undefined &&
      dto.eventId === undefined
    ) {
      throw new BadRequestException(
        'Debes indicar al menos un dato de la cuenta para actualizar.',
      );
    }

    const data: UpdateExpenseAccountData = {
      ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
      ...(dto.memberIds === undefined ? {} : { memberIds: dto.memberIds }),
      ...(dto.eventId === undefined ? {} : { eventId: dto.eventId }),
    };
    const updatedAccount =
      await this.expenseAccountRepository.updateExpenseAccount(
        accountId,
        userId,
        data,
      );

    return ExpenseAccountMapper.toResponse(updatedAccount);
  }

  deleteExpenseAccount(accountId: number, userId: number): Promise<void> {
    return this.expenseAccountRepository.deleteExpenseAccount(
      accountId,
      userId,
    );
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
      userId,
    );

    return ExpenseAccountMapper.toExpenseResponse(createdExpense);
  }

  async updateExpense(
    updateExpenseDto: UpdateExpenseDto,
    accountId: number,
    expenseId: number,
    userId: number,
  ): Promise<ExpenseResponseDto> {
    const isEqualSplit = updateExpenseDto.splitType === ExpenseSplitType.EQUAL;
    const participantIds = isEqualSplit
      ? [...new Set(updateExpenseDto.participantIds ?? [])]
      : (updateExpenseDto.shares ?? []).map((share) => share.memberId);

    if (participantIds.length === 0) {
      throw new BadRequestException(
        'Debes indicar al menos un participante del gasto.',
      );
    }

    const shares = isEqualSplit
      ? splitEqually(updateExpenseDto.amountCents, participantIds)
      : (updateExpenseDto.shares ?? []).map((share) => ({
          memberId: share.memberId,
          amountCents: share.amountCents,
        }));

    if (!isEqualSplit) {
      this.expenseAccountValidator.validateCustomSharesTotal(
        updateExpenseDto.amountCents,
        shares,
      );
    }

    const data: CreateExpenseData = {
      title:
        updateExpenseDto.title === undefined
          ? undefined
          : updateExpenseDto.title?.trim() || null,
      amountCents: updateExpenseDto.amountCents,
      payerMemberId: updateExpenseDto.payerMemberId,
      splitType: updateExpenseDto.splitType,
      shares,
    };
    const updatedExpense = await this.expenseAccountRepository.updateExpense(
      accountId,
      expenseId,
      userId,
      data,
    );

    return ExpenseAccountMapper.toExpenseResponse(updatedExpense);
  }

  deleteExpense(
    accountId: number,
    expenseId: number,
    userId: number,
  ): Promise<void> {
    return this.expenseAccountRepository.deleteExpense(
      accountId,
      expenseId,
      userId,
    );
  }

  async getPendingExpenseShares(
    accountId: number,
    userId: number,
  ): Promise<PendingExpenseShareResponseDto[]> {
    const { member } =
      await this.expenseAccountValidator.requireAccountMembership(
        accountId,
        userId,
      );
    const shares = await this.expenseAccountRepository.findPendingExpenseShares(
      accountId,
      member.id,
    );

    return shares.map((share) =>
      ExpenseAccountMapper.toPendingExpenseShareResponse(share),
    );
  }

  async getPendingExpenseAdjustments(
    accountId: number,
    userId: number,
  ): Promise<PendingExpenseAdjustmentResponseDto[]> {
    const { member } =
      await this.expenseAccountValidator.requireAccountMembership(
        accountId,
        userId,
      );
    const adjustments =
      await this.expenseAccountRepository.findPendingExpenseAdjustments(
        accountId,
        member.id,
      );

    return adjustments.map((adjustment) =>
      ExpenseAccountMapper.toPendingExpenseAdjustmentResponse(adjustment),
    );
  }

  async registerExpensePayments(
    accountId: number,
    userId: number,
    dto: RegisterExpensePaymentsDto,
  ): Promise<ExpensePaymentResponseDto[]> {
    const expenseShareIds = dto.expenseShareIds ?? [];
    const adjustmentIds = dto.adjustmentIds ?? [];
    if (expenseShareIds.length === 0 && adjustmentIds.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos una participación o un ajuste pendiente.',
      );
    }
    const { member } =
      await this.expenseAccountValidator.requireAccountMembership(
        accountId,
        userId,
      );
    const payments =
      await this.expenseAccountRepository.registerExpensePayments(
        accountId,
        member.id,
        expenseShareIds,
        adjustmentIds,
      );

    return payments.map((payment) =>
      ExpenseAccountMapper.toExpensePaymentResponse(payment),
    );
  }

  async registerAllExpensePayments(
    accountId: number,
    userId: number,
  ): Promise<ExpensePaymentResponseDto[]> {
    const { member } =
      await this.expenseAccountValidator.requireAccountMembership(
        accountId,
        userId,
      );
    const payments =
      await this.expenseAccountRepository.registerExpensePayments(
        accountId,
        member.id,
        null,
        null,
      );

    return payments.map((payment) =>
      ExpenseAccountMapper.toExpensePaymentResponse(payment),
    );
  }

  async annulExpensePayment(
    accountId: number,
    paymentId: number,
    userId: number,
  ): Promise<ExpensePaymentResponseDto> {
    const payment = await this.expenseAccountRepository.annulExpensePayment(
      accountId,
      paymentId,
      userId,
    );

    return ExpenseAccountMapper.toExpensePaymentResponse(payment);
  }
}
