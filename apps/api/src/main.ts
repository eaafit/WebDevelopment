import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Code, ConnectError, cors } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import express from 'express';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';
import { AuthInterceptor } from '@internal/auth';
import { PaymentWebhookError, PaymentWebhookService } from '@internal/billing';
import {
  DocumentFileUrlService,
  DocumentObjectNotFoundError,
  DocumentService,
  DocumentStorageUnavailableError,
} from '@internal/document';
import { MetricsService } from '@internal/metrics';
import { PrismaService } from '@internal/prisma';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const connectRouterRegistry = app.get(ConnectRouterRegistry);
  const authInterceptor = app.get(AuthInterceptor);
  const documentService = app.get(DocumentService);
  const documentFileUrlService = app.get(DocumentFileUrlService);
  const paymentWebhookService = app.get(PaymentWebhookService);

  app.enableCors({
    origin: true,
    methods: [...cors.allowedMethods],
    allowedHeaders: [...cors.allowedHeaders, 'Authorization'],
    exposedHeaders: [...cors.exposedHeaders],
  });

  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance();

  expressInstance.get('/health', async (_req: express.Request, res: express.Response) => {
    try {
      const prisma = app.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', database: 'error' });
    }
  });

  expressInstance.get('/metrics', async (_req: express.Request, res: express.Response) => {
    try {
      const metricsService = app.get(MetricsService);
      const content = await metricsService.getMetrics();
      const contentType = metricsService.getContentType();
      res.setHeader('Content-Type', contentType);
      res.end(content);
    } catch {
      res.status(500).end();
    }
  });

  expressInstance.get(
    '/api/documents/:documentId/content',
    async (req: express.Request, res: express.Response) => {
      const documentId = req.params['documentId'] ?? '';
      const accessGrant = documentFileUrlService.validateAccess({
        documentId,
        mode: asString(req.query['mode']),
        expires: asString(req.query['expires']),
        signature: asString(req.query['signature']),
      });

      if (!accessGrant) {
        res.status(403).json({ error: 'invalid or expired document url' });
        return;
      }

      try {
        const file = await documentService.getDocumentFile(documentId);
        if (!file) {
          res.status(404).json({ error: `document ${documentId} not found` });
          return;
        }

        res.setHeader('Content-Type', file.fileType);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader(
          'Content-Disposition',
          buildContentDisposition(
            accessGrant.mode === 'download' ? 'attachment' : 'inline',
            file.fileName,
          ),
        );

        if (file.fileSize > 0) {
          res.setHeader('Content-Length', String(file.fileSize));
        }

        file.body.pipe(res);
      } catch (error: unknown) {
        writeDocumentFileError(res, error);
      }
    },
  );

  expressInstance.post(
    '/api/payments/webhook',
    express.json(),
    (req: express.Request, res: express.Response) => {
      paymentWebhookService
        .handleYooKassaNotification(req.body, {
          signature: resolveWebhookSignature(req),
        })
        .then(() => res.status(200).end())
        .catch((error: unknown) => {
          if (error instanceof PaymentWebhookError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
          }
          res.status(500).end();
        });
    },
  );

  app.use(
    connectNodeAdapter({
      connect: true,
      grpc: false,
      grpcWeb: false,
      interceptors: [authInterceptor.build()],
      routes: (router) => connectRouterRegistry.register(router),
    }),
  );

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  Logger.log(`Connect RPC server is running on http://localhost:${port}`);
}

bootstrap();

function resolveWebhookSignature(req: express.Request): string | undefined {
  const fromQuery = typeof req.query['secret'] === 'string' ? req.query['secret'] : undefined;
  const fromHeader =
    req.header('x-payment-webhook-secret') ??
    req.header('x-yookassa-signature') ??
    parseBearerToken(req.header('authorization'));
  return (fromQuery ?? fromHeader)?.trim() || undefined;
}

function parseBearerToken(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function writeDocumentFileError(res: express.Response, error: unknown): void {
  if (error instanceof DocumentObjectNotFoundError) {
    res.status(404).json({ error: 'document file not found' });
    return;
  }

  if (error instanceof DocumentStorageUnavailableError) {
    res.status(503).json({ error: 'document object storage unavailable' });
    return;
  }

  if (error instanceof ConnectError) {
    if (error.code === Code.InvalidArgument) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (error.code === Code.NotFound) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.code === Code.Unavailable) {
      res.status(503).json({ error: error.message });
      return;
    }
  }

  res.status(500).json({ error: 'unexpected document file error' });
}

function buildContentDisposition(
  dispositionType: 'inline' | 'attachment',
  fileName: string,
): string {
  const safeFileName = sanitizeAsciiFileName(fileName);
  const encodedFileName = encodeRfc5987(fileName);
  return `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
}

function sanitizeAsciiFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[/\\"]/g, '_')
    .replace(/[^\x20-\x7E]+/g, '_')
    .trim();

  return sanitized || 'document';
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
