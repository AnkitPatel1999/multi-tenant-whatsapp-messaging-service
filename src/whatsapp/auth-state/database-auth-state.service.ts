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
        authState.state.creds = decryptedCreds;
        this.logger.log(`Loaded credentials for device ${deviceId}`);
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
        authState.state.keys[keyType][keyId] = decryptedKey;
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
      await this.sessionModel.updateMany(
        { deviceId },
        { isActive: false }
      );
      
      this.logger.log(`Cleared session data for device ${deviceId}`);
    } catch (error) {
      this.logger.error(`Error clearing session for device ${deviceId}:`, error.message);
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
      // Save credentials
      if (authState.creds && Object.keys(authState.creds).length > 0) {
        await this.saveCredentials(deviceId, userId, tenantId, authState.creds);
      }
      
      // Save keys
      if (authState.keys && Object.keys(authState.keys).length > 0) {
        await this.saveKeys(deviceId, userId, tenantId, authState.keys);
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
}
