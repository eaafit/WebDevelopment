import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';
import { DocumentRpcService } from './document-rpc.service';
import { DocumentFileUrlService } from './document-file-url.service';
import { DocumentStorageService } from './document-storage.service';

@Module({
  imports: [PrismaModule],
  providers: [
    DocumentRepository,
    DocumentFileUrlService,
    DocumentStorageService,
    DocumentService,
    DocumentRpcService,
  ],
  exports: [DocumentRpcService, DocumentFileUrlService, DocumentService],
})
export class DocumentModule {}
