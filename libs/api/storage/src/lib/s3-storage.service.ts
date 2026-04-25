import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

export interface StoredObject {
  body: Buffer;
  contentType: string | null;
  contentLength: number | null;
}

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = this.requireEnv('S3_BUCKET_PAYMENT_DOCUMENTS');
    const endpoint = process.env['S3_ENDPOINT'];
    this.client = new S3Client({
      region: process.env['S3_REGION'] ?? 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId: this.requireEnv('S3_ACCESS_KEY'),
        secretAccessKey: this.requireEnv('S3_SECRET_KEY'),
      },
      forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] !== 'false',
    });
  }

  get bucketName(): string {
    return this.bucket;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<StoredObject> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const bytes = response.Body ? await response.Body.transformToByteArray() : new Uint8Array();

    return {
      body: Buffer.from(bytes),
      contentType: response.ContentType ?? null,
      contentLength: response.ContentLength ?? null,
    };
  }

  private requireEnv(name: string): string {
    const v = process.env[name];
    if (!v?.trim()) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return v.trim();
  }
}
