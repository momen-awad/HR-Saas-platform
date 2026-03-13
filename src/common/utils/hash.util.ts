// src/common/utils/hash.util.ts

import * as bcrypt from 'bcrypt';
import { createHash, createHmac } from 'crypto';

/**
 * HashUtil provides one-way hashing functions.
 *
 * Bcrypt: For password hashing (intentionally slow, with salt)
 * SHA-256: For audit log chain integrity and checksums
 * HMAC-SHA256: For webhook signature verification
 */
export class HashUtil {
  /**
   * Bcrypt rounds — calibrated for ~250ms hash time.
   * Increase by 1 every ~2 years as hardware gets faster.
   * 12 rounds ≈ 250ms on modern hardware (2024).
   */
  private static readonly BCRYPT_ROUNDS = 12;

  // ── Password Hashing (Bcrypt) ──

  /**
   * Hash a password using bcrypt.
   * Returns the hash string including the salt.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, HashUtil.BCRYPT_ROUNDS);
  }

  /**
   * Verify a password against a bcrypt hash.
   */
  static async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ── SHA-256 (Checksums & Audit Chains) ──

  /**
   * Generate a SHA-256 hash of a string.
   * Used for audit log chain integrity.
   */
  static sha256(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Generate a chained hash for audit logs.
   * Each log entry's hash includes the previous entry's hash,
   * creating a tamper-evident chain.
   *
   * @param data - The current entry's data (JSON string)
   * @param previousHash - The hash of the previous entry (or '' for first)
   */
  static chainHash(data: string, previousHash: string = ''): string {
    return HashUtil.sha256(`${previousHash}:${data}`);
  }

  // ── HMAC-SHA256 (Webhook Signatures) ──

  /**
   * Generate an HMAC-SHA256 signature.
   * Used for outbound webhook payload signing.
   */
  static hmacSha256(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
  }

  /**
   * Verify an HMAC-SHA256 signature with timing-safe comparison.
   */
  static verifyHmac(
    data: string,
    secret: string,
    signature: string,
  ): boolean {
    const expected = HashUtil.hmacSha256(data, secret);
    // Constant-time comparison to prevent timing attacks
    if (expected.length !== signature.length) return false;

    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');

    return require('crypto').timingSafeEqual(expectedBuf, signatureBuf);
  }
}

