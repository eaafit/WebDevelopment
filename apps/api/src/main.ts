import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { cors } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  const connectRouterRegistry = app.get(ConnectRouterRegistry);

  app.enableCors({
    origin: true,
    methods: [...cors.allowedMethods],
    allowedHeaders: [...cors.allowedHeaders],
    exposedHeaders: [...cors.exposedHeaders],
  });
  app.use(
    connectNodeAdapter({
      connect: true,
      grpc: false,
      grpcWeb: false,
      routes: (router) => connectRouterRegistry.register(router),
    }),
  );

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  Logger.log(`Connect RPC server is running on http://localhost:${port}`);
}

bootstrap();
