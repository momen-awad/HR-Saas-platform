// src/common/utils/__tests__/hash.util.spec.ts

import { HashUtil } from '../hash.util';

describe('HashUtil', () => {
  describe('password hashing', () => {
    it('should hash and verify a password', async () => {
      const password = 'MySecureP@ssw0rd!';
      const hash = await HashUtil.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]?\$.{56}$/); // bcrypt format
      expect(await HashUtil.verifyPassword(password, hash)).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hash = await HashUtil.hashPassword('correct-password');
      expect(await HashUtil.verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('should produce different hashes for same password (random salt)', async () => {
      const password = 'same-password';
      const hash1 = await HashUtil.hashPassword(password);
      const hash2 = await HashUtil.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await HashUtil.verifyPassword(password, hash1)).toBe(true);
      expect(await HashUtil.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('SHA-256', () => {
    it('should produce consistent hash', () => {
      const data = 'test-data';
      const hash1 = HashUtil.sha256(data);
      const hash2 = HashUtil.sha256(data);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex chars
    });

    it('should produce different hashes for different data', () => {
      expect(HashUtil.sha256('data1')).not.toBe(HashUtil.sha256('data2'));
    });
  });

  describe('chain hash', () => {
    it('should create tamper-evident chain', () => {
      const hash1 = HashUtil.chainHash('{"action":"create","id":"1"}', '');
      const hash2 = HashUtil.chainHash('{"action":"update","id":"1"}', hash1);
      const hash3 = HashUtil.chainHash('{"action":"delete","id":"1"}', hash2);

      // Verify chain is reproducible
      const verify1 = HashUtil.chainHash('{"action":"create","id":"1"}', '');
      expect(verify1).toBe(hash1);

      // Verify tampering breaks the chain
      const tamperedHash2 = HashUtil.chainHash('{"action":"TAMPERED","id":"1"}', hash1);
      expect(tamperedHash2).not.toBe(hash2);
    });
  });

  describe('HMAC', () => {
    it('should generate and verify HMAC', () => {
      const data = '{"event":"payroll.finalized","id":"123"}';
      const secret = 'webhook-secret-key';

      const signature = HashUtil.hmacSha256(data, secret);
      expect(HashUtil.verifyHmac(data, secret, signature)).toBe(true);
    });

    it('should reject tampered data', () => {
      const secret = 'webhook-secret-key';
      const signature = HashUtil.hmacSha256('original-data', secret);
      expect(HashUtil.verifyHmac('tampered-data', secret, signature)).toBe(false);
    });

    it('should reject wrong secret', () => {
      const data = 'test-data';
      const signature = HashUtil.hmacSha256(data, 'correct-secret');
      expect(HashUtil.verifyHmac(data, 'wrong-secret', signature)).toBe(false);
    });
  });
});

