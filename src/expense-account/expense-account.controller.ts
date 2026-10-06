import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import { CreateExpenseAccountDto } from './dto/create-expense-account.dto';
import { ExpenseAccountResponseDto } from './dto/expense-account-response.dto';
import { ExpenseAccountService } from './expense-account.service';

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/expense-account')
export class ExpenseAccountController {
  constructor(private readonly expenseAccountService: ExpenseAccountService) {}

  @Post()
  create(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: CreateExpenseAccountDto,
    @CurrentUser() userId: number,
  ): Promise<ExpenseAccountResponseDto> {
    return this.expenseAccountService.createExpenseAccount(
      dto,
      groupId,
      userId,
    );
  }
}
