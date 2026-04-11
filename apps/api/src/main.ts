import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { cors as connectCors } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import cors from 'cors';
import express from 'express';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';
import { AuthInterceptor, TokenService } from '@internal/auth';
import {
  PaymentAttachmentService,
  PaymentWebhookError,
  PaymentWebhookService,
} from '@internal/billing';
import { MetricsService } from '@internal/metrics';
import { PrismaService } from '@internal/prisma';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance();

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
      methods: [...connectCors.allowedMethods],
      allowedHeaders: [...connectCors.allowedHeaders, 'Authorization'],
      exposedHeaders: [...connectCors.exposedHeaders],
    }),
  );

  const connectRouterRegistry = app.get(ConnectRouterRegistry);
  const authInterceptor = app.get(AuthInterceptor);
  const tokenService = app.get(TokenService);
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
      const metricsService = app.get(MetricsService);
      const content = await metricsService.getMetrics();
      const contentType = metricsService.getContentType();
      res.setHeader('Content-Type', contentType);
      res.end(content);
    } catch {
      res.status(500).end();
    }
  });

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
