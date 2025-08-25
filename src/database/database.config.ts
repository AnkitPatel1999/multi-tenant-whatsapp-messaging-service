import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (configService: ConfigService): MongooseModuleOptions => {
  const mongoUri = configService.get<string>('database.url');
  
  if (!mongoUri) {
    throw new Error('No database URI configured. Please set MONGODB_URI or database.url');
  }

  return {
    uri: mongoUri,
    connectionFactory: (connection) => {
      connection.on('connected', () => {
        console.log('MongoDB connected successfully');
      });

      connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
      });

      connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
      });

      return connection;
    },
    // Disable mongoose buffering for better error handling
    bufferCommands: false,
  };
};

/**
 * Database indexes configuration for optimal query performance
 */
export const DATABASE_INDEXES = {
  // User indexes
  users: [
    { email: 1, tenantId: 1 }, // Unique compound index
    { tenantId: 1, isActive: 1 },
    { createdAt: -1 },
  ],

  // WhatsApp Device indexes
  whatsappdevices: [
    { deviceId: 1 }, // Unique
    { userId: 1, tenantId: 1 },
    { userId: 1, tenantId: 1, isConnected: 1 },
    { createdAt: -1 },
    { lastConnectedAt: -1 },
  ],

  // WhatsApp Message indexes
  whatsappmessages: [
    { deviceId: 1, messageId: 1 }, // Unique compound index
    { deviceId: 1, chatId: 1, timestamp: -1 }, // Chat history queries
    { deviceId: 1, direction: 1, timestamp: -1 }, // Direction-based queries
    { userId: 1, tenantId: 1, timestamp: -1 }, // User message history
    { deviceId: 1, status: 1 }, // Message status queries
    { chatId: 1, timestamp: -1 }, // Individual chat queries
    { createdAt: -1 }, // General sorting
    { 
      textContent: 'text', 
      caption: 'text' 
    }, // Text search index
  ],

  // WhatsApp Contact indexes
  whatsappcontacts: [
    { deviceId: 1, whatsappId: 1 }, // Unique compound index
    { deviceId: 1, userId: 1, tenantId: 1 },
    { phoneNumber: 1 },
    { name: 1 },
    { deviceId: 1, isActive: 1 },
    { lastSyncedAt: -1 },
  ],

  // WhatsApp Group indexes
  whatsappgroups: [
    { deviceId: 1, whatsappGroupId: 1 }, // Unique compound index
    { deviceId: 1, userId: 1, tenantId: 1 },
    { deviceId: 1, isActive: 1 },
    { participantCount: -1 },
    { lastSyncedAt: -1 },
  ],

  // WhatsApp Session indexes
  whatsappsessions: [
    { deviceId: 1, keyType: 1, keyId: 1 }, // Unique compound index
    { deviceId: 1, isActive: 1 },
    { lastAccessed: -1 },
    { userId: 1, tenantId: 1 },
  ],

  // Message Log indexes
  messagelogs: [
    { deviceId: 1, timestamp: -1 },
    { userId: 1, tenantId: 1, timestamp: -1 },
    { status: 1, timestamp: -1 },
    { messageType: 1, timestamp: -1 },
  ],
} as const;

/**
 * Performance monitoring queries for database optimization
 */
export const PERFORMANCE_QUERIES = {
  // Find slow queries
  slowQueries: {
    'profile': { 'ts': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  },

  // Index usage stats
  indexStats: '$indexStats',

  // Collection stats for monitoring
  collectionStats: (collectionName: string) => ({
    collStats: collectionName,
    indexDetails: true,
  }),
} as const;
