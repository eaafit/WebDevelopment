import 'dotenv/config';
import './tracing';
import { NestFactory } from '@nestjs/core';
import { cors as connectCors, createContextValues } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import cors from 'cors';
import express from 'express';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';
import { createHttpLoggingMiddleware } from './app/logging/logging.config';
import { registerWebLogIngestion } from './app/logging/web-log-ingest';
import { createFailedAccessMetricsMiddleware } from './app/security/failed-access-metrics.middleware';
import { createHttpRequestDurationMetricsMiddleware } from './app/security/http-request-duration-metrics.middleware';
import { AuthInterceptor, TokenService } from '@internal/auth';
import { REQUEST_IP_CONTEXT_KEY } from '@internal/auth-shared';
import {
  PaymentAttachmentService,
  PaymentWebhookError,
  PaymentWebhookService,
} from '@internal/billing';
import { DocumentFileUrlService, DocumentService } from '@internal/document';
import { MetricsService } from '@internal/metrics';
import { PrismaService } from '@internal/prisma';
import { handleDocumentContentRequest } from './app/document-content-route';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoNestLogger));

  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance();
  const metricsService = app.get(MetricsService);
  expressInstance.use(createHttpLoggingMiddleware());
  expressInstance.use('/api', express.json());
  expressInstance.use(createHttpRequestDurationMetricsMiddleware(metricsService));
  expressInstance.use(createFailedAccessMetricsMiddleware(metricsService));

  // Register on the raw Express app before `listen()` → `init()` adds Nest routes, so
  // OPTIONS preflight is handled here — Connect only allows POST/GET and would respond
  // without CORS headers otherwise.
  const corsOriginEnv = process.env['CORS_ORIGIN'];
  const corsOriginList = corsOriginEnv
    ? corsOriginEnv
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;
  expressInstance.use(
    cors({
      origin:
        corsOriginList && corsOriginList.length > 0
          ? corsOriginList
          : (requestOrigin: string | undefined, cb) => {
              cb(null, requestOrigin ? requestOrigin : true);
            },
      methods: [...connectCors.allowedMethods, 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: [
        ...connectCors.allowedHeaders,
        'Authorization',
        'X-Request-Id',
        'traceparent',
      ],
      exposedHeaders: [...connectCors.exposedHeaders, 'X-Request-Id'],
    }),
  );

  const connectRouterRegistry = app.get(ConnectRouterRegistry);
  const authInterceptor = app.get(AuthInterceptor);
  const tokenService = app.get(TokenService);
  const documentService = app.get(DocumentService);
  const documentFileUrlService = app.get(DocumentFileUrlService);
  const paymentWebhookService = app.get(PaymentWebhookService);
  const paymentAttachmentService = app.get(PaymentAttachmentService);

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
      const content = await metricsService.getMetrics();
      const contentType = metricsService.getContentType();
      res.setHeader('Content-Type', contentType);
      res.end(content);
    } catch {
      res.status(500).end();
    }
  });

  registerWebLogIngestion(expressInstance, undefined, metricsService);

  expressInstance.get(
    '/api/documents/:documentId/content',
    async (req: express.Request, res: express.Response) => {
      await handleDocumentContentRequest(req, res, {
        documentService,
        documentFileUrlService,
      });
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

  expressInstance.post(
    '/api/payments/robokassa/result',
    express.urlencoded({ extended: false }),
    (req: express.Request, res: express.Response) => {
      paymentWebhookService
        .handleRobokassaResult(req.body)
        .then((result) => res.status(200).type('text/plain').send(result))
        .catch((error: unknown) => {
          if (error instanceof PaymentWebhookError) {
            res.status(error.statusCode).send(error.message);
            return;
          }
          res.status(500).send('Internal server error');
        });
    },
  );

  expressInstance.get(
    '/api/payments/:paymentId/receipt',
    (req: express.Request, res: express.Response) => {
      const token = parseBearerToken(req.header('authorization'));
      if (!token) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      let payload;
      try {
        payload = tokenService.verifyAccessToken(token);
      } catch {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      paymentAttachmentService
        .getReceiptFile({
          paymentId: req.params['paymentId'],
          userId: payload.sub,
          role: payload.role,
        })
        .then((receipt) => {
          const dispositionType = req.query['download'] === '1' ? 'attachment' : 'inline';
          res.setHeader('Content-Type', receipt.contentType);
          res.setHeader(
            'Content-Disposition',
            `${dispositionType}; filename*=UTF-8''${encodeURIComponent(receipt.fileName)}`,
          );
          res.setHeader('Cache-Control', 'no-store');
          res.status(200).send(receipt.body);
        })
        .catch((error: unknown) => {
          if (isHttpError(error)) {
            res.status(error.statusCode ?? error.status).json({ message: error.message });
            return;
          }

          res.status(500).json({ message: 'Internal server error' });
        });
    },
  );

  app.use(
    '/rpc',
    connectNodeAdapter({
      connect: true,
      grpc: false,
      grpcWeb: false,
      interceptors: [authInterceptor.build()],
      contextValues: (req) => {
        const values = createContextValues();
        values.set(REQUEST_IP_CONTEXT_KEY, resolveRequestIp(req));
        return values;
      },
      routes: (router) => connectRouterRegistry.register(router),
    }),
  );

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  app.get(PinoNestLogger).log(`Connect RPC server is running on http://localhost:${port}`);
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

function resolveRequestIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | null };
}): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || null;
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(',')[0]?.trim() || null;
  }

  return req.socket?.remoteAddress ?? null;
}

function isHttpError(
  error: unknown,
): error is { status?: number; statusCode?: number; message: string } {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { status?: unknown; statusCode?: unknown; message?: unknown };
  return (
    typeof (candidate.statusCode ?? candidate.status) === 'number' &&
    typeof candidate.message === 'string'
  );
}
