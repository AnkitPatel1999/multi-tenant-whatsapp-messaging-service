import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsAppSession, WhatsAppSessionDocument } from '../../schema/whatsapp-session.schema';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';

@Injectable()
export class DatabaseAuthStateService {
  private readonly logger = new Logger(DatabaseAuthStateService.name);

  constructor(
    @InjectModel(WhatsAppSession.name) private sessionModel: Model<WhatsAppSessionDocument>,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a custom auth state that stores data in database
   */
  async createDatabaseAuthState(deviceId: string, userId: string, tenantId: string) {
    // Initialize with proper structure that Baileys expects
    const state = {
      creds: {} as any,
      keys: {
        get: (type: string, ids: string[]) => {
          const result = {};
          for (const id of ids) {
            if (state.keys[type] && state.keys[type][id]) {
              result[id] = state.keys[type][id];
            }
          }
          return result;
        },
        set: (data: any) => {
          for (const category in data) {
            state.keys[category] = state.keys[category] || {};
            Object.assign(state.keys[category], data[category]);
          }
        }
      } as any
    };

    const authState = {
      state,
      saveCreds: async () => {
        await this.saveCredentials(deviceId, userId, tenantId, state.creds);
      },
      saveKeys: async () => {
        await this.saveKeys(deviceId, userId, tenantId, state.keys);
      }
    };

    // Load existing credentials and keys
    await this.loadAuthState(deviceId, authState);

    return authState;
  }

  /**
   * Load auth state from database
   */
  private async loadAuthState(deviceId: string, authState: any): Promise<void> {
    try {
      // Load credentials
      const credsSession = await this.sessionModel.findOne({
        deviceId,
        keyType: 'creds',
        isActive: true
      }).exec();

      if (credsSession) {
        const decryptedCreds = this.encryptionService.decryptSimple(
          credsSession.encryptedData,
          credsSession.iv
        );
        // Restore Buffers in credentials
        authState.state.creds = this.restoreBuffers(decryptedCreds);
        this.logger.log(`Loaded credentials for device ${deviceId} with Buffer restoration`);
      }

      // Load keys
      const keysSessions = await this.sessionModel.find({
        deviceId,
        keyType: 'keys',
        isActive: true
      }).exec();

      for (const keySession of keysSessions) {
        const decryptedKey = this.encryptionService.decryptSimple(
          keySession.encryptedData,
          keySession.iv
        );
        // Store keys in the format Baileys expects
        const keyType = keySession.keyId.split(':')[0] || 'app-state-sync-key';
        const keyId = keySession.keyId.split(':')[1] || keySession.keyId;
        
        if (!authState.state.keys[keyType]) {
          authState.state.keys[keyType] = {};
        }
        // Restore Buffers in keys
        authState.state.keys[keyType][keyId] = this.restoreBuffers(decryptedKey);
      }
      
      this.logger.log(`Loaded ${keysSessions.length} keys for device ${deviceId}`);

    } catch (error) {
      this.logger.error(`Error loading auth state for device ${deviceId}:`, error.message);
      // Initialize empty state if loading fails
      authState.state.creds = {};
      // Keys object already has proper structure from initialization
    }
  }

  /**
   * Save credentials to database
   */
  private async saveCredentials(deviceId: string, userId: string, tenantId: string, creds: any): Promise<void> {
    try {
      if (!creds || Object.keys(creds).length === 0) {
        this.logger.debug(`No credentials to save for device ${deviceId}`);
        return;
      }

      const { encryptedData, iv } = this.encryptionService.encryptSimple(creds);

      await this.sessionModel.findOneAndUpdate(
        {
          deviceId,
          keyType: 'creds',
          keyId: 'main'
        },
        {
          sessionId: uuidv4(),
          deviceId,
          userId,
          tenantId,
          keyType: 'creds',
          keyId: 'main',
          encryptedData,
          iv,
          isActive: true,
          lastAccessed: new Date()
        },
        {
          upsert: true,
          new: true
        }
      );

      this.logger.log(`Saved credentials for device ${deviceId}`);
    } catch (error) {
      this.logger.error(`Error saving credentials for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Save keys to database
   */
  private async saveKeys(deviceId: string, userId: string, tenantId: string, keys: any): Promise<void> {
    try {
      if (!keys) {
        this.logger.debug(`No keys to save for device ${deviceId}`);
        return;
      }

      const savePromises: Promise<any>[] = [];
      
      // Iterate through key categories (like 'app-state-sync-key', 'sender-key', etc.)
      for (const [keyType, keyGroup] of Object.entries(keys)) {
        if (keyType === 'get' || keyType === 'set' || typeof keyGroup !== 'object') {
          continue; // Skip function properties
        }
        
        for (const [keyId, keyData] of Object.entries(keyGroup as any)) {
          const { encryptedData, iv } = this.encryptionService.encryptSimple(keyData);
          const compositeKeyId = `${keyType}:${keyId}`;

          const savePromise = this.sessionModel.findOneAndUpdate(
            {
              deviceId,
              keyType: 'keys',
              keyId: compositeKeyId
            },
            {
              sessionId: uuidv4(),
              deviceId,
              userId,
              tenantId,
              keyType: 'keys',
              keyId: compositeKeyId,
              encryptedData,
              iv,
              isActive: true,
              lastAccessed: new Date()
            },
            {
              upsert: true,
              new: true
            }
          );
          
          savePromises.push(savePromise);
        }
      }

      if (savePromises.length > 0) {
        await Promise.all(savePromises);
        this.logger.log(`Saved ${savePromises.length} keys for device ${deviceId}`);
      }
    } catch (error) {
      this.logger.error(`Error saving keys for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Clear all session data for a device
   */
  async clearDeviceSession(deviceId: string): Promise<void> {
    try {
      const result = await this.sessionModel.updateMany(
        { deviceId },
        { isActive: false }
      );
      
      this.logger.log(`Cleared session data for device ${deviceId} (${result.modifiedCount} records updated)`);
    } catch (error) {
      this.logger.error(`Error clearing session for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Clear corrupted session data that might contain malformed buffers
   */
  async clearCorruptedSession(deviceId: string): Promise<void> {
    try {
      // First, mark old sessions as inactive
      await this.sessionModel.updateMany(
        { deviceId },
        { isActive: false }
      );

      // Delete the records entirely to ensure clean state
      const result = await this.sessionModel.deleteMany(
        { deviceId, isActive: false }
      );
      
      this.logger.warn(`Cleared corrupted session data for device ${deviceId} (${result.deletedCount} records deleted)`);
    } catch (error) {
      this.logger.error(`Error clearing corrupted session for device ${deviceId}:`, error.message);
    }
  }

  /**
   * Check if device has existing credentials in database
   */
  async hasExistingCredentials(deviceId: string): Promise<boolean> {
    try {
      const credsSession = await this.sessionModel.findOne({
        deviceId,
        keyType: 'creds',
        isActive: true
      }).exec();
      
      return !!credsSession;
    } catch (error) {
      this.logger.error(`Error checking existing credentials for device ${deviceId}:`, error.message);
      return false;
    }
  }

  /**
   * Migrate auth state from file-based to database storage
   */
  async migrateFromFileAuth(deviceId: string, userId: string, tenantId: string, authState: any): Promise<void> {
    try {
      // Save credentials - ensure buffers are properly handled
      if (authState.creds && Object.keys(authState.creds).length > 0) {
        // Buffers should already be in correct format from file auth, but ensure they're preserved
        await this.saveCredentials(deviceId, userId, tenantId, authState.creds);
      }
      
      // Save keys - ensure buffers are properly handled
      if (authState.keys && Object.keys(authState.keys).length > 0) {
        // Filter out function properties before saving
        const keysToSave = {};
        for (const [keyType, keyGroup] of Object.entries(authState.keys)) {
          if (keyType !== 'get' && keyType !== 'set' && typeof keyGroup === 'object') {
            keysToSave[keyType] = keyGroup;
          }
        }
        await this.saveKeys(deviceId, userId, tenantId, keysToSave);
      }
      
      this.logger.log(`Successfully migrated auth state to database for device ${deviceId}`);
    } catch (error) {
      this.logger.error(`Error migrating auth state for device ${deviceId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get session statistics for a device
   */
  async getSessionStats(deviceId: string): Promise<any> {
    try {
      const stats = await this.sessionModel.aggregate([
        { $match: { deviceId, isActive: true } },
        {
          $group: {
            _id: '$keyType',
            count: { $sum: 1 },
            lastAccessed: { $max: '$lastAccessed' }
          }
        }
      ]);

      return stats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          lastAccessed: stat.lastAccessed
        };
        return acc;
      }, {});
    } catch (error) {
      this.logger.error(`Error getting session stats for device ${deviceId}:`, error.message);
      return {};
    }
  }

  /**
   * Recursively restore Buffer objects from serialized data
   * When JSON.stringify() is called on a Buffer, it becomes {type: 'Buffer', data: [array]}
   * This method converts those objects back to actual Buffer instances
   */
  private restoreBuffers(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Check if this is a serialized Buffer
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return Buffer.from(obj.data);
    }

    // Check if this is a Uint8Array (another way buffers can be serialized)
    if (obj.constructor && obj.constructor.name === 'Object' && typeof obj.length === 'number' && obj.length >= 0) {
      // Check if it looks like a typed array
      const keys = Object.keys(obj);
      if (keys.every(key => /^\d+$/.test(key) || key === 'length')) {
        // Convert to Buffer if it looks like a byte array
        const data = new Array(obj.length);
        for (let i = 0; i < obj.length; i++) {
          data[i] = obj[i];
        }
        return Buffer.from(data);
      }
    }

    // If it's an array, recursively process each element
    if (Array.isArray(obj)) {
      return obj.map(item => this.restoreBuffers(item));
    }

    // If it's a plain object, recursively process each property
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.restoreBuffers(value);
    }

    return result;
  }
}
