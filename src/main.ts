import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Add global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Add request logging middleware with masking
  app.use((req, res, next) => {
    const mask = (obj: any) => {
      try {
        if (!obj || typeof obj !== 'object') return obj;
        const clone: any = Array.isArray(obj) ? [...obj] : { ...obj };
        const SENSITIVE_KEYS = ['authorization', 'password', 'token', 'access_token', 'refresh_token'];
        for (const key of Object.keys(clone)) {
          if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
            clone[key] = '[REDACTED]';
          }
        }
        return clone;
      } catch {
        return obj;
      }
    };
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(mask(req.headers), null, 2));
    if (req.body) {
      console.log('Body:', JSON.stringify(mask(req.body), null, 2));
    }
    next();
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();