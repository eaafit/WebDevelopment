import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { cors } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import express from 'express';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';
import { AuthInterceptor } from '@internal/auth';
import { PaymentWebhookService } from '@internal/billing';
import { MetricsService } from '@internal/metrics';
import { PrismaService } from '@internal/prisma';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const connectRouterRegistry = app.get(ConnectRouterRegistry);
  const authInterceptor = app.get(AuthInterceptor);
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

  expressInstance.post(
    '/api/payments/webhook',
    express.json(),
    (req: express.Request, res: express.Response) => {
      paymentWebhookService
        .handleYooKassaNotification(req.body)
        .then(() => res.status(200).end())
        .catch(() => res.status(500).end());
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
