import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { Code, ConnectError } from '@connectrpc/connect';
import { Injectable } from '@nestjs/common';
import { DOCUMENT_UPLOADS_ROUTE, getDocumentUploadsRoot } from './document-storage.paths';

interface SaveDocumentFileParams {
  assessmentId: string;
  fileName: string;
  content: Uint8Array;
}

@Injectable()
export class DocumentStorageService {
  async saveFile(params: SaveDocumentFileParams): Promise<string> {
    const safeFileName = sanitizeFileName(params.fileName);
    const relativeDirectory = path.posix.join('documents', params.assessmentId);
    const relativePath = path.posix.join(relativeDirectory, `${randomUUID()}-${safeFileName}`);
    const absolutePath = this.resolveAbsolutePath(relativePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(params.content));

    return path.posix.join(DOCUMENT_UPLOADS_ROUTE, relativePath);
  }

  async deleteFile(publicPath: string): Promise<void> {
    const relativePath = this.toRelativePath(publicPath);
    if (!relativePath) {
      return;
    }

    await rm(this.resolveAbsolutePath(relativePath), { force: true });
  }

  private resolveAbsolutePath(relativePath: string): string {
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    const root = getDocumentUploadsRoot();
    const absolutePath = path.resolve(root, normalizedRelativePath);

    if (!isWithinRoot(root, absolutePath)) {
      throw new ConnectError('invalid file path', Code.InvalidArgument);
    }

    return absolutePath;
  }

  private toRelativePath(publicPath: string): string | null {
    const normalizedPublicPath = publicPath.replace(/\\/g, '/').trim();
    const prefix = `${DOCUMENT_UPLOADS_ROUTE}/`;

    if (!normalizedPublicPath.startsWith(prefix)) {
      return null;
    }

    return normalizedPublicPath.slice(prefix.length);
  }
}

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName).trim();
  const sanitized = baseName.replace(/[^A-Za-z0-9._-]+/g, '_');
  return sanitized || 'document.bin';
}

function isWithinRoot(root: string, absolutePath: string): boolean {
  const relativePath = path.relative(root, absolutePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
