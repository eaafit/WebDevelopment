import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { cors } from '@connectrpc/connect';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { AppModule } from './app/app.module';
import { ConnectRouterRegistry } from './app/connect-router.registry';
import { AuthInterceptor } from '@internal/auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const connectRouterRegistry = app.get(ConnectRouterRegistry);
  const authInterceptor        = app.get(AuthInterceptor);

  app.enableCors({
    origin: true,
    methods: [...cors.allowedMethods],
    allowedHeaders: [...cors.allowedHeaders, 'Authorization'],
    exposedHeaders: [...cors.exposedHeaders],
  });

  app.use(
    connectNodeAdapter({
      connect:      true,
      grpc:         false,
      grpcWeb:      false,
      interceptors: [authInterceptor.build()],
      routes:       (router) => connectRouterRegistry.register(router),
    }),
  );

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  Logger.log(`Connect RPC server is running on http://localhost:${port}`);
}

bootstrap();
