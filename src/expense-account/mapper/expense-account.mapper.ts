import { CreateExpenseAccountDto } from '../dto/create-expense-account.dto';
import { ExpenseAccountDetailResponseDto } from '../dto/expense-account-detail-response.dto';
import { ExpenseAccountResponseDto } from '../dto/expense-account-response.dto';
import { MyExpenseAccountResponseDto } from '../dto/my-expense-account-response.dto';
import {
  calculateBalances,
  calculateDebtsOfMember,
  calculateDebtsToMember,
  toBalanceStatus,
} from '../balance/expense-account-balance.calculator';
import {
  ExpenseAccountDetailEntity,
  MyExpenseAccountData,
} from '../entity/expense-account-detail.entity';
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

  static toMyAccountResponse(
    account: MyExpenseAccountData,
  ): MyExpenseAccountResponseDto {
    const balances = calculateBalances(account.memberIds, account.movements);
    const myBalance =
      balances.find((balance) => balance.memberId === account.myMemberId)
        ?.balanceCents ?? 0;

    return {
      id: account.id,
      name: account.name,
      groupId: account.groupId,
      groupName: account.groupName,
      eventId: account.eventId,
      eventName: account.eventName,
      balanceCents: myBalance,
      status: toBalanceStatus(myBalance),
    };
  }

  static toDetailResponse(
    account: ExpenseAccountDetailEntity,
    myMemberId: number,
  ): ExpenseAccountDetailResponseDto {
    const balances = calculateBalances(account.memberIds, account.movements);
    const myBalance =
      balances.find((balance) => balance.memberId === myMemberId)
        ?.balanceCents ?? 0;

    return {
      id: account.id,
      name: account.name,
      groupId: account.groupId,
      groupName: account.groupName,
      eventId: account.eventId,
      eventName: account.eventName,
      members: balances,
      myBalanceCents: myBalance,
      myStatus: toBalanceStatus(myBalance),
      debtsToMe: calculateDebtsToMember(account.movements, myMemberId),
      myDebts: calculateDebtsOfMember(account.movements, myMemberId),
      movements: account.movements,
    };
  }
}
