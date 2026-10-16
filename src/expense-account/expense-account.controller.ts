import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreateExpenseAccountDto } from './dto/create-expense-account.dto';
import { ExpenseAccountDetailResponseDto } from './dto/expense-account-detail-response.dto';
import { ExpenseAccountResponseDto } from './dto/expense-account-response.dto';
import { MyExpenseAccountResponseDto } from './dto/my-expense-account-response.dto';
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
}
