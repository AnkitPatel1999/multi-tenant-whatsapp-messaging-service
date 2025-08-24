import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';

let mongod: MongoMemoryServer;
let connection: Connection;

/**
 * Setup test database for integration tests
 */
export const setupTestDatabase = async (): Promise<Connection> => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  const moduleRef = await Test.createTestingModule({
    imports: [
      MongooseModule.forRoot(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  
  connection = app.get('DatabaseConnection');
  return connection;
};

/**
 * Cleanup test database
 */
export const teardownTestDatabase = async (): Promise<void> => {
  if (connection) {
    await connection.dropDatabase();
    await connection.close();
  }
  
  if (mongod) {
    await mongod.stop();
  }
};

/**
 * Clear all collections in test database
 */
export const clearTestDatabase = async (): Promise<void> => {
  if (connection) {
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
};

/**
 * Create test module with common providers
 */
export const createTestModule = async (providers: any[] = [], imports: any[] = []): Promise<TestingModule> => {
  return await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      ...imports,
    ],
    providers,
  }).compile();
};
