import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits

  constructor() {
    // Ensure encryption key is available
    if (!process.env.WHATSAPP_ENCRYPTION_KEY) {
      this.logger.warn('WHATSAPP_ENCRYPTION_KEY not set. Using default key (NOT SECURE for production)');
    }
  }

  private getEncryptionKey(): Buffer {
    const key = process.env.WHATSAPP_ENCRYPTION_KEY || 'default-key-not-secure-change-this-in-production';
    return crypto.scryptSync(key, 'salt', this.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: any): { encryptedData: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.getEncryptionKey();
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from('whatsapp-session'));

      const plaintext = JSON.stringify(data);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error.message);
      throw new Error('Failed to encrypt session data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: string, iv: string, tag: string): any {
    try {
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
      decipher.setAAD(Buffer.from('whatsapp-session'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Decryption failed:', error.message);
      throw new Error('Failed to decrypt session data');
    }
  }

  /**
   * Simplified encrypt method that returns only encrypted data and iv
   */
  encryptSimple(data: any): { encryptedData: string; iv: string } {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.getEncryptionKey();
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      const plaintext = JSON.stringify(data);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      this.logger.error('Simple encryption failed:', error.message);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Simplified decrypt method
   */
  decryptSimple(encryptedData: string, iv: string): any {
    try {
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error('Simple decryption failed:', error.message);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure hash for data integrity
   */
  generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using hash
   */
  verifyHash(data: string, hash: string): boolean {
    const computedHash = this.generateHash(data);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }
}
