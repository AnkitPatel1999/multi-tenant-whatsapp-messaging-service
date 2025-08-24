import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private connection: Connection) {}

  async onModuleInit() {
    // Index creation removed - indexes are now defined in schemas
    this.monitorConnection();
  }

  /**
   * Monitor database connection health
   */
  private monitorConnection(): void {
    // Log connection pool stats periodically
    setInterval(() => {
      this.logConnectionStats();
    }, 60000); // Every minute

    // Monitor for connection issues
    this.connection.on('error', (error) => {
      this.logger.error('Database connection error:', error);
    });

    this.connection.on('disconnected', () => {
      this.logger.warn('Database disconnected - attempting to reconnect...');
    });

    this.connection.on('reconnected', () => {
      this.logger.log('Database reconnected successfully');
    });
  }

  /**
   * Log connection pool statistics
   */
  private logConnectionStats(): void {
    try {
      const db = this.connection.db;
      const stats = {
        readyState: this.connection.readyState,
        name: this.connection.name,
        host: this.connection.host,
        port: this.connection.port,
      };

      this.logger.debug('Database connection stats:', stats);
    } catch (error) {
      this.logger.debug('Could not retrieve connection stats:', error.message);
    }
  }

  /**
   * Get database performance statistics
   */
  async getPerformanceStats(): Promise<any> {
    try {
      const db = this.connection.db;
      if (!db) {
        return { error: 'Database connection not available' };
      }
      
      // Get database stats
      const dbStats = await db.stats();
      
      // Get collection stats for main collections
      const collectionStats = {};
      const mainCollections = ['whatsappmessages', 'whatsappcontacts', 'whatsappgroups', 'users'];
      
      for (const collName of mainCollections) {
        try {
          // Use MongoDB native stats command
          const collStats = await db.command({ collStats: collName });
          collectionStats[collName] = {
            count: collStats.count || 0,
            avgObjSize: collStats.avgObjSize || 0,
            storageSize: collStats.storageSize || 0,
            indexSizes: collStats.indexSizes || {},
          };
        } catch (error) {
          // Collection might not exist yet
          collectionStats[collName] = { error: 'Collection not found' };
        }
      }

      return {
        database: {
          collections: dbStats.collections,
          objects: dbStats.objects,
          avgObjSize: dbStats.avgObjSize,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize,
        },
        collections: collectionStats,
        connection: {
          readyState: this.connection.readyState,
          name: this.connection.name,
          host: this.connection.host,
          port: this.connection.port,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get performance stats:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Check index usage and suggest optimizations
   */
  async analyzeIndexUsage(collectionName: string): Promise<any> {
    try {
      if (!this.connection.db) {
        return { error: 'Database connection not available' };
      }
      const collection = this.connection.db.collection(collectionName);
      
      // Get index stats
      const indexStats = await collection.aggregate([{ $indexStats: {} }]).toArray();
      
      // Analyze usage
      const analysis = indexStats.map(stat => ({
        name: stat.name,
        accesses: stat.accesses,
        usage: stat.accesses.ops > 0 ? 'Used' : 'Unused',
        recommendation: stat.accesses.ops === 0 ? 'Consider removing if not needed' : 'Keep',
      }));

      return {
        collection: collectionName,
        indexAnalysis: analysis,
        totalIndexes: indexStats.length,
        unusedIndexes: analysis.filter(a => a.usage === 'Unused').length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to analyze index usage for ${collectionName}:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * Get slow query information (requires profiling to be enabled)
   */
  async getSlowQueries(hours: number = 24): Promise<any> {
    try {
      const db = this.connection.db;
      if (!db) {
        return { error: 'Database connection not available' };
      }
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const slowQueries = await db.collection('system.profile')
        .find({
          ts: { $gte: cutoffTime },
          millis: { $gte: 100 } // Queries taking more than 100ms
        })
        .sort({ millis: -1 })
        .limit(50)
        .toArray();

      return {
        cutoffTime,
        hours,
        slowQueries: slowQueries.map(q => ({
          timestamp: q.ts,
          duration: q.millis,
          operation: q.op,
          namespace: q.ns,
          command: q.command,
          planSummary: q.planSummary,
        })),
        count: slowQueries.length,
      };
    } catch (error) {
      this.logger.error('Failed to get slow queries:', error.message);
      return { 
        error: error.message,
        note: 'Database profiling might not be enabled'
      };
    }
  }

  /**
   * Health check for database
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.connection && this.connection.db) {
        await this.connection.db.admin().ping();
      }
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error.message);
      return false;
    }
  }

  /**
   * Optimize database by running maintenance commands
   */
  async optimize(): Promise<any> {
    try {
      if (!this.connection.db) {
        return { error: 'Database connection not available' };
      }

      const results: any[] = [];
      
      // Compact collections (MongoDB 4.4+)
      const mainCollections = ['whatsappmessages', 'whatsappcontacts', 'whatsappgroups'];
      
      for (const collName of mainCollections) {
        try {
          // Note: compact operation locks the collection
          // Consider running during maintenance windows
          this.logger.log(`Starting optimization for collection: ${collName}`);
          
          // Use MongoDB reIndex command instead of collection method
          await this.connection.db.command({ reIndex: collName });
          
          results.push({
            collection: collName,
            status: 'reindexed',
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          results.push({
            collection: collName,
            status: 'failed',
            error: error.message,
          });
        }
      }

      return {
        optimization: 'completed',
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Database optimization failed:', error.message);
      return { error: error.message };
    }
  }
}
