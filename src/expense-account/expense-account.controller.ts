import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
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
import { ExpenseAccountService } from './expense-account.service';

@UseGuards(SessionAuthGuard)
@Controller('expense-account')
export class ExpenseAccountController {
  constructor(private readonly expenseAccountService: ExpenseAccountService) {}

  @Post()
  create(
    @Body() dto: CreateExpenseAccountDto,
    @CurrentUser() userId: number,
  ): Promise<ExpenseAccountResponseDto> {
    return this.expenseAccountService.createExpenseAccount(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseAccountDto,
    @CurrentUser() userId: number,
  ): Promise<ExpenseAccountResponseDto> {
    return this.expenseAccountService.updateExpenseAccount(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<void> {
    return this.expenseAccountService.deleteExpenseAccount(id, userId);
  }

  @Get()
  getMine(
    @CurrentUser() userId: number,
  ): Promise<MyExpenseAccountResponseDto[]> {
    return this.expenseAccountService.getMyAccounts(userId);
  }

  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<ExpenseAccountDetailResponseDto> {
    return this.expenseAccountService.getAccountDetail(id, userId);
  }

  @Post(':id/expense')
  createExpense(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() userId: number,
  ): Promise<ExpenseResponseDto> {
    return this.expenseAccountService.createExpense(dto, id, userId);
  }

  @Patch(':accountId/expense/:expenseId')
  updateExpense(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() userId: number,
  ): Promise<ExpenseResponseDto> {
    return this.expenseAccountService.updateExpense(
      dto,
      accountId,
      expenseId,
      userId,
    );
  }

  @Get(':id/pending-shares')
  getPendingShares(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<PendingExpenseShareResponseDto[]> {
    return this.expenseAccountService.getPendingExpenseShares(id, userId);
  }

  @Get(':id/pending-adjustments')
  getPendingAdjustments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<PendingExpenseAdjustmentResponseDto[]> {
    return this.expenseAccountService.getPendingExpenseAdjustments(id, userId);
  }

  @Post(':id/payments')
  registerPayments(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegisterExpensePaymentsDto,
    @CurrentUser() userId: number,
  ): Promise<ExpensePaymentResponseDto[]> {
    return this.expenseAccountService.registerExpensePayments(id, userId, dto);
  }

  @Post(':id/payments/all')
  registerAllPayments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() userId: number,
  ): Promise<ExpensePaymentResponseDto[]> {
    return this.expenseAccountService.registerAllExpensePayments(id, userId);
  }
}
