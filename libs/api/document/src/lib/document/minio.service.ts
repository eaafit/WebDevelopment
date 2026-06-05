import { Injectable } from '@nestjs/common';
// 1. Импортируем S3Client и нужные команды из главного пакета @aws-sdk/client-s3
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// 2. Импортируем getSignedUrl из пакета @aws-sdk/s3-request-presigner
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class MinioService {
  private s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env['S3_BUCKET_ASSESSMENT_FILES'] || 'assessment-files';

    // 3. Инициализируем клиент. Здесь ничего не меняется.
    this.s3Client = new S3Client({
      region: process.env['S3_REGION'] || 'us-east-1',
      endpoint: process.env['S3_ENDPOINT'] || 'http://127.0.0.1:9000',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] || 'minioadmin',
        secretAccessKey: process.env['S3_SECRET_KEY'] || 'minioadmin',
      },
      forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] !== 'false',
    });
  }

  async uploadFile(fileBuffer: Buffer, originalName: string, fileType: string): Promise<string> {
    const extension = originalName.split('.').pop() || 'bin';
    const objectKey = `documents/${crypto.randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: fileType,
    });

    await this.s3Client.send(command);

    return objectKey;
  }

  async generatePresignedUrl(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });
    return await getSignedUrl(this.s3Client as any, command as any, { expiresIn: 900 });
  }
}