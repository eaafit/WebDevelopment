import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { DocumentType as PrismaDocumentType } from '@internal/prisma-client';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import path from 'path';
import { Readable } from 'stream';

export interface SaveDocumentFileParams {
  assessmentId: string;
  fileName: string;
  content: Uint8Array;
  contentType: string;
  documentType: PrismaDocumentType;
}

export interface StoredDocumentLocation {
  bucketName: string;
  objectKey: string;
}

export interface StoredDocumentObject extends StoredDocumentLocation {
  body: Readable;
  contentLength?: number;
  contentType?: string;
}

export class DocumentObjectNotFoundError extends Error {
  constructor(message = 'document object not found') {
    super(message);
    this.name = 'DocumentObjectNotFoundError';
  }
}

export class DocumentStorageUnavailableError extends Error {
  constructor(message = 'document object storage unavailable') {
    super(message);
    this.name = 'DocumentStorageUnavailableError';
  }
}

@Injectable()
export class DocumentStorageService {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = this.requireEnv('S3_BUCKET_ASSESSMENT_FILES');
    const endpoint = process.env['S3_ENDPOINT']?.trim();

    this.client = new S3Client({
      region: process.env['S3_REGION']?.trim() || 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: this.requireEnv('S3_ACCESS_KEY'),
        secretAccessKey: this.requireEnv('S3_SECRET_KEY'),
      },
      forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] !== 'false',
    });
  }

  async saveFile(
    params: SaveDocumentFileParams,
  ): Promise<StoredDocumentLocation & { fileSize: number }> {
    const objectKey = buildObjectKey(params.assessmentId, params.documentType, params.fileName);
    const body = Buffer.from(params.content);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          Body: body,
          ContentType: params.contentType,
        }),
      );
    } catch (error: unknown) {
      throw toStorageUnavailable(error);
    }

    return {
      bucketName: this.bucketName,
      objectKey,
      fileSize: body.length,
    };
  }

  async deleteFile(location: StoredDocumentLocation): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: location.bucketName,
          Key: location.objectKey,
        }),
      );
    } catch (error: unknown) {
      if (isMissingObjectError(error)) {
        return;
      }

      throw toStorageUnavailable(error);
    }
  }

  async getFile(location: StoredDocumentLocation): Promise<StoredDocumentObject> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: location.bucketName,
          Key: location.objectKey,
        }),
      );

      if (!response.Body) {
        throw new DocumentStorageUnavailableError('document object body is empty');
      }

      return {
        bucketName: location.bucketName,
        objectKey: location.objectKey,
        body: toNodeReadable(response.Body),
        contentLength:
          typeof response.ContentLength === 'number' ? response.ContentLength : undefined,
        contentType: response.ContentType?.trim() || undefined,
      };
    } catch (error: unknown) {
      if (isMissingObjectError(error)) {
        throw new DocumentObjectNotFoundError();
      }

      throw toStorageUnavailable(error);
    }
  }

  private requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }
}

function buildObjectKey(
  assessmentId: string,
  documentType: PrismaDocumentType,
  fileName: string,
): string {
  const prefix = resolvePrefix(documentType);
  const extension = resolveExtension(fileName);
  return `${prefix}/${assessmentId}/${randomUUID()}${extension}`;
}

function resolvePrefix(documentType: PrismaDocumentType): string {
  if (documentType === PrismaDocumentType.Photo) {
    return 'photos';
  }

  if (documentType === PrismaDocumentType.Additional) {
    return 'additional';
  }

  return 'documents';
}

function resolveExtension(fileName: string): string {
  const extension = path.extname(path.basename(fileName)).trim().toLowerCase();
  return /^\.[a-z0-9]{1,16}$/u.test(extension) ? extension : '';
}

function isMissingObjectError(error: unknown): boolean {
  if (error instanceof S3ServiceException) {
    return error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404;
  }

  return false;
}

function toStorageUnavailable(error: unknown): DocumentStorageUnavailableError {
  if (error instanceof DocumentStorageUnavailableError) {
    return error;
  }

  return new DocumentStorageUnavailableError(error instanceof Error ? error.message : undefined);
}

function toNodeReadable(body: unknown): Readable {
  if (body instanceof Readable) {
    return body;
  }

  if (isWebReadableStream(body) && typeof Readable.fromWeb === 'function') {
    return Readable.fromWeb(body as never);
  }

  throw new DocumentStorageUnavailableError('unsupported document object body type');
}

function isWebReadableStream(value: unknown): value is ReadableStream {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getReader' in value &&
    typeof value.getReader === 'function'
  );
}
