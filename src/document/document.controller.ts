import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/user.decorator';
import { SessionAuthGuard } from '../user/guard/session-auth.guard';
import {
  DocumentInputDto,
  DocumentQueryDto,
  FolderInputDto,
} from './document.dto';
import { MAX_DOCUMENT_BYTES } from './document-file';
import type { DocumentFile } from './document-file';
import { DocumentService } from './document.service';

const upload = FileInterceptor('file', {
  limits: {
    fileSize: MAX_DOCUMENT_BYTES,
    files: 1,
    fields: 3,
    fieldSize: 1024,
  },
});

@UseGuards(SessionAuthGuard)
@Controller('group/:groupId/documentation')
export class DocumentController {
  constructor(private readonly service: DocumentService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  list(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Query() query: DocumentQueryDto,
  ) {
    return this.service.list(groupId, userId, query);
  }

  @Post('documents')
  @UseInterceptors(upload)
  create(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Body() dto: DocumentInputDto,
    @UploadedFile() file?: DocumentFile,
  ) {
    return this.service.save(groupId, userId, dto, file);
  }

  @Patch('documents/:id')
  @UseInterceptors(upload)
  update(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DocumentInputDto,
    @UploadedFile() file?: DocumentFile,
  ) {
    return this.service.save(groupId, userId, dto, file, id);
  }

  @Get('documents/:id/content')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async content(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.download(groupId, userId, id);
    response.setHeader('Content-Type', file.mimeType);
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: 'inline',
      length: file.buffer.length,
    });
  }

  @Delete('documents/:id')
  @HttpCode(204)
  deleteDocument(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteDocument(groupId, userId, id);
  }

  @Post('folders')
  createFolder(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Body() dto: FolderInputDto,
  ) {
    return this.service.createFolder(groupId, userId, dto);
  }

  @Patch('folders/:id')
  renameFolder(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FolderInputDto,
  ) {
    return this.service.renameFolder(groupId, userId, id, dto);
  }

  @Delete('folders/:id')
  @HttpCode(204)
  deleteFolder(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() userId: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteFolder(groupId, userId, id);
  }
}
