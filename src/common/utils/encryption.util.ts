// src/common/utils/encryption.util.ts

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * EncryptionService provides AES-256-GCM field-level encryption.
 *
 * Used for encrypting sensitive employee data at rest:
 * - Base salary
 * - Bank account numbers
 * - Tax identification numbers
 * - MFA secrets
 *
 * Features:
 * - AES-256-GCM (authenticated encryption — tamper detection)
 * - Unique IV per encryption (prevents pattern analysis)
 * - Key versioning for rotation without re-encrypting
 * - Deterministic key derivation from master key
 * - Null-safe operations for optional fields
 *
 * Encrypted format (binary):
 *   [version: 1 byte][iv: 12 bytes][authTag: 16 bytes][ciphertext: N bytes]
 *
 * IMPORTANT: The master encryption key must come from environment
 * variables or a secrets manager. NEVER hardcode it.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;
const CURRENT_KEY_VERSION = 1;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly keys: Map<number, Buffer> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeKeys();
  }

  /**
   * Derive encryption keys from the master key.
   * Key versioning allows rotation: add new version, keep old for decryption.
   */
  private initializeKeys(): void {
    const masterKey = this.configService.get<string>('ENCRYPTION_KEY');
    
    if (!masterKey || masterKey.length < 32) {
      throw new Error(
        'ENCRYPTION_KEY must be at least 32 characters. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    // Derive version-specific keys using scrypt
    // This means even if the master key is the same, each version
    // produces a different derived key
    const key1 = scryptSync(masterKey, 'v1-salt-hr-saas', 32);
    this.keys.set(1, key1);

    // Future versions:
    // const key2 = scryptSync(newMasterKey, 'v2-salt-hr-saas', 32);
    // this.keys.set(2, key2);
  }

  /**
   * Encrypt a plaintext string.
   * 
   * @param plaintext - The value to encrypt (e.g., "75000.00")
   * @returns Base64-encoded encrypted string, or null if input is null/undefined
   * 
   * Null-safety: Returns null for null/undefined inputs to handle optional fields
   */
  encrypt(plaintext: string | null | undefined): string | null {
    // ✅ Handle null/undefined: return null to preserve optional field semantics
    if (plaintext === null || plaintext === undefined) {
      return null;
    }
    
    // ✅ Handle empty string: return empty (no need to encrypt empty data)
    if (plaintext === '') {
      return '';
    }

    const key = this.keys.get(CURRENT_KEY_VERSION);
    if (!key) {
      throw new Error(`Encryption key version ${CURRENT_KEY_VERSION} not found`);
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Pack: [version][iv][authTag][ciphertext]
    const packed = Buffer.concat([
      Buffer.from([CURRENT_KEY_VERSION]),
      iv,
      authTag,
      encrypted,
    ]);

    return packed.toString('base64');
  }

  /**
   * Decrypt a base64-encoded encrypted string.
   * 
   * @param encryptedBase64 - The encrypted value from the database
   * @returns The original plaintext, or null if input is null/undefined
   * 
   * Null-safety: Returns null for null/undefined inputs to handle optional fields
   */
  decrypt(encryptedBase64: string | null | undefined): string | null {
    // ✅ Handle null/undefined: return null to preserve optional field semantics
    if (encryptedBase64 === null || encryptedBase64 === undefined) {
      return null;
    }
    
    // ✅ Handle empty string: return empty
    if (encryptedBase64 === '') {
      return '';
    }

    const packed = Buffer.from(encryptedBase64, 'base64');

    // Unpack: [version: 1][iv: 12][authTag: 16][ciphertext: rest]
    const version = packed[0];
    const iv = packed.subarray(1, 1 + IV_LENGTH);
    const authTag = packed.subarray(
      1 + IV_LENGTH,
      1 + IV_LENGTH + AUTH_TAG_LENGTH,
    );
    const ciphertext = packed.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);

    const key = this.keys.get(version);
    if (!key) {
      throw new Error(
        `Encryption key version ${version} not found. ` +
        'This may indicate data encrypted with a newer key version.',
      );
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Mask a decrypted value for display in logs or UI.
   * Example: "1234567890" → "******7890"
   * 
   * @param value - The value to mask
   * @param visibleChars - Number of characters to show at the end (default: 4)
   * @returns Masked string, or null if input is null/undefined
   */
  static mask(
    value: string | null | undefined, 
    visibleChars: number = 4
  ): string | null {
    // ✅ Handle null/undefined: return null
    if (value === null || value === undefined) {
      return null;
    }
    
    // ✅ Handle empty string
    if (value === '') {
      return '';
    }
    
    // If value is shorter than visibleChars, mask everything
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }
    
    const masked = '*'.repeat(value.length - visibleChars);
    return masked + value.slice(-visibleChars);
  }

  /**
   * Utility: Generate a new random encryption key (32 bytes = 256 bits).
   * Use this for creating a new ENCRYPTION_KEY during deployment.
   */
  static generateKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Utility: Validate if a key is properly formatted for AES-256.
   */
  static isValidKey(key: string | undefined): boolean {
    if (!key) return false;
    // AES-256 requires 32 bytes = 64 hex characters
    return /^[0-9a-f]{64}$/i.test(key);
  }
}
