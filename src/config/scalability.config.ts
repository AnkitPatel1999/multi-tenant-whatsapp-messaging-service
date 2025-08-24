import { ConfigService } from '@nestjs/config';

export interface ScalabilityConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    queueDb: number;
    maxRetriesPerRequest: number;
    connectTimeout: number;
    commandTimeout: number;
  };
  database: {
    maxPoolSize: number;
    minPoolSize: number;
    maxIdleTimeMS: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    connectTimeoutMS: number;
    autoIndex: boolean;
    monitorCommands: boolean;
  };
  queue: {
    defaultJobOptions: {
      attempts: number;
      backoffDelay: number;
      removeOnComplete: number;
      removeOnFail: number;
    };
    concurrency: {
      messageQueue: number;
      contactSync: number;
      fileUpload: number;
    };
    rateLimiting: {
      normal: number;
      high: number;
      critical: number;
    };
  };
  cache: {
    ttl: {
      userSession: number;
      tenantMetadata: number;
      whatsappContacts: number;
      whatsappGroups: number;
      deviceStatus: number;
      messageStats: number;
    };
    maxItems: number;
  };
  performance: {
    enableProfiling: boolean;
    slowQueryThreshold: number;
    enableIndexAnalysis: boolean;
    optimizationInterval: number;
  };
}

export const getScalabilityConfig = (configService: ConfigService): ScalabilityConfig => ({
  redis: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    db: configService.get<number>('REDIS_DB', 0),
    queueDb: configService.get<number>('REDIS_QUEUE_DB', 1),
    maxRetriesPerRequest: configService.get<number>('REDIS_MAX_RETRIES', 3),
    connectTimeout: configService.get<number>('REDIS_CONNECT_TIMEOUT', 10000),
    commandTimeout: configService.get<number>('REDIS_COMMAND_TIMEOUT', 5000),
  },
  
  database: {
    maxPoolSize: configService.get<number>('DB_MAX_POOL_SIZE', 10),
    minPoolSize: configService.get<number>('DB_MIN_POOL_SIZE', 2),
    maxIdleTimeMS: configService.get<number>('DB_MAX_IDLE_TIME', 30000),
    serverSelectionTimeoutMS: configService.get<number>('DB_SERVER_SELECTION_TIMEOUT', 5000),
    socketTimeoutMS: configService.get<number>('DB_SOCKET_TIMEOUT', 45000),
    connectTimeoutMS: configService.get<number>('DB_CONNECT_TIMEOUT', 10000),
    autoIndex: configService.get<boolean>('DB_AUTO_INDEX', false),
    monitorCommands: configService.get<boolean>('DB_MONITOR_COMMANDS', false),
  },
  
  queue: {
    defaultJobOptions: {
      attempts: configService.get<number>('QUEUE_DEFAULT_ATTEMPTS', 3),
      backoffDelay: configService.get<number>('QUEUE_BACKOFF_DELAY', 2000),
      removeOnComplete: configService.get<number>('QUEUE_REMOVE_ON_COMPLETE', 100),
      removeOnFail: configService.get<number>('QUEUE_REMOVE_ON_FAIL', 50),
    },
    concurrency: {
      messageQueue: configService.get<number>('QUEUE_MESSAGE_CONCURRENCY', 5),
      contactSync: configService.get<number>('QUEUE_CONTACT_CONCURRENCY', 2),
      fileUpload: configService.get<number>('QUEUE_FILE_CONCURRENCY', 3),
    },
    rateLimiting: {
      normal: configService.get<number>('RATE_LIMIT_NORMAL', 60), // per minute
      high: configService.get<number>('RATE_LIMIT_HIGH', 100),
      critical: configService.get<number>('RATE_LIMIT_CRITICAL', 200),
    },
  },
  
  cache: {
    ttl: {
      userSession: configService.get<number>('CACHE_TTL_USER_SESSION', 3600), // 1 hour
      tenantMetadata: configService.get<number>('CACHE_TTL_TENANT_METADATA', 7200), // 2 hours
      whatsappContacts: configService.get<number>('CACHE_TTL_WHATSAPP_CONTACTS', 1800), // 30 min
      whatsappGroups: configService.get<number>('CACHE_TTL_WHATSAPP_GROUPS', 1800), // 30 min
      deviceStatus: configService.get<number>('CACHE_TTL_DEVICE_STATUS', 300), // 5 min
      messageStats: configService.get<number>('CACHE_TTL_MESSAGE_STATS', 86400), // 24 hours
    },
    maxItems: configService.get<number>('CACHE_MAX_ITEMS', 10000),
  },
  
  performance: {
    enableProfiling: configService.get<boolean>('ENABLE_DB_PROFILING', false),
    slowQueryThreshold: configService.get<number>('SLOW_QUERY_THRESHOLD', 100), // ms
    enableIndexAnalysis: configService.get<boolean>('ENABLE_INDEX_ANALYSIS', true),
    optimizationInterval: configService.get<number>('DB_OPTIMIZATION_INTERVAL', 86400000), // 24 hours
  },
});

/**
 * Environment variables template for .env file
 */
export const ENV_TEMPLATE = `
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_QUEUE_DB=1
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000

# Database Connection Pool
DB_MAX_POOL_SIZE=10
DB_MIN_POOL_SIZE=2
DB_MAX_IDLE_TIME=30000
DB_SERVER_SELECTION_TIMEOUT=5000
DB_SOCKET_TIMEOUT=45000
DB_CONNECT_TIMEOUT=10000
DB_AUTO_INDEX=false
DB_MONITOR_COMMANDS=false

# Queue Configuration
QUEUE_DEFAULT_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=2000
QUEUE_REMOVE_ON_COMPLETE=100
QUEUE_REMOVE_ON_FAIL=50
QUEUE_MESSAGE_CONCURRENCY=5
QUEUE_CONTACT_CONCURRENCY=2
QUEUE_FILE_CONCURRENCY=3

# Rate Limiting (requests per minute)
RATE_LIMIT_NORMAL=60
RATE_LIMIT_HIGH=100
RATE_LIMIT_CRITICAL=200

# Cache TTL Settings (seconds)
CACHE_TTL_USER_SESSION=3600
CACHE_TTL_TENANT_METADATA=7200
CACHE_TTL_WHATSAPP_CONTACTS=1800
CACHE_TTL_WHATSAPP_GROUPS=1800
CACHE_TTL_DEVICE_STATUS=300
CACHE_TTL_MESSAGE_STATS=86400
CACHE_MAX_ITEMS=10000

# Performance Monitoring
ENABLE_DB_PROFILING=false
SLOW_QUERY_THRESHOLD=100
ENABLE_INDEX_ANALYSIS=true
DB_OPTIMIZATION_INTERVAL=86400000
`.trim();

/**
 * Production-optimized environment variables
 */
export const PRODUCTION_ENV = `
# Production Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
REDIS_QUEUE_DB=1
REDIS_MAX_RETRIES=5
REDIS_CONNECT_TIMEOUT=15000
REDIS_COMMAND_TIMEOUT=10000

# Production Database Pool
DB_MAX_POOL_SIZE=20
DB_MIN_POOL_SIZE=5
DB_MAX_IDLE_TIME=60000
DB_SERVER_SELECTION_TIMEOUT=10000
DB_SOCKET_TIMEOUT=60000
DB_CONNECT_TIMEOUT=15000
DB_AUTO_INDEX=false
DB_MONITOR_COMMANDS=false

# Production Queue Settings
QUEUE_DEFAULT_ATTEMPTS=5
QUEUE_BACKOFF_DELAY=5000
QUEUE_REMOVE_ON_COMPLETE=50
QUEUE_REMOVE_ON_FAIL=25
QUEUE_MESSAGE_CONCURRENCY=10
QUEUE_CONTACT_CONCURRENCY=3
QUEUE_FILE_CONCURRENCY=5

# Production Rate Limits
RATE_LIMIT_NORMAL=120
RATE_LIMIT_HIGH=300
RATE_LIMIT_CRITICAL=500

# Production Cache Settings
CACHE_TTL_USER_SESSION=7200
CACHE_TTL_TENANT_METADATA=14400
CACHE_TTL_WHATSAPP_CONTACTS=3600
CACHE_TTL_WHATSAPP_GROUPS=3600
CACHE_TTL_DEVICE_STATUS=600
CACHE_TTL_MESSAGE_STATS=172800
CACHE_MAX_ITEMS=50000

# Production Performance
ENABLE_DB_PROFILING=false
SLOW_QUERY_THRESHOLD=200
ENABLE_INDEX_ANALYSIS=true
DB_OPTIMIZATION_INTERVAL=172800000
`.trim();
