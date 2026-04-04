import { Module } from '@nestjs/common';
import { PrismaModule } from '@internal/prisma';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';
import { DocumentRpcService } from './document-rpc.service';
import { DocumentStorageService } from './document-storage.service';

@Module({
  imports: [PrismaModule],
  providers: [DocumentRepository, DocumentStorageService, DocumentService, DocumentRpcService],
  exports: [DocumentRpcService],
})
export class DocumentModule {}
