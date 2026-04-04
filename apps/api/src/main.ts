import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { cors as connectCors } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import cors from 'cors';
import express from 'express';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';
import { AuthInterceptor } from '@internal/auth';
import { PaymentWebhookError, PaymentWebhookService } from '@internal/billing';
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
  const paymentWebhookService = app.get(PaymentWebhookService);

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
