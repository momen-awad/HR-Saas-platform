// src/common/utils/__tests__/encryption.util.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption.util';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'ENCRYPTION_KEY') {
                // مفتاح تجريبي بطول 64 حرفاً (32 بايت hex) للاختبار
                return 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a salary value', () => {
    const original = '75000.00';
    const encrypted = service.encrypt(original);
    const decrypted = service.decrypt(encrypted);

    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const plaintext = '50000.00';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    // Different ciphertext due to random IV
    expect(encrypted1).not.toBe(encrypted2);

    // Both decrypt to same value
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });

  it('should handle empty string', () => {
    expect(service.encrypt('')).toBe('');
    expect(service.decrypt('')).toBe('');
  });

  it('should handle null/undefined gracefully', () => {
    // وفقاً للتعديل الذي أجريناه، يجب أن تعيد null
    expect(service.encrypt(null as any)).toBeNull();
    expect(service.decrypt(null as any)).toBeNull();
    expect(service.encrypt(undefined as any)).toBeNull();
    expect(service.decrypt(undefined as any)).toBeNull();
  });

  it('should encrypt and decrypt bank account numbers', () => {
    const bankAccount = 'GB29NWBK60161331926819';
    const encrypted = service.encrypt(bankAccount);
    expect(service.decrypt(encrypted)).toBe(bankAccount);
  });

  it('should encrypt and decrypt unicode text', () => {
    const arabicName = 'محمد أحمد';
    const encrypted = service.encrypt(arabicName);
    expect(service.decrypt(encrypted)).toBe(arabicName);
  });

  it('should detect tampering (GCM auth tag verification)', () => {
    const encrypted = service.encrypt('sensitive-data');
    // Tamper with the encrypted data
    const buffer = Buffer.from(encrypted, 'base64');
    buffer[buffer.length - 1] ^= 0xff; // Flip last byte
    const tampered = buffer.toString('base64');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  describe('mask', () => {
    it('should mask with default visible chars', () => {
      expect(EncryptionService.mask('1234567890')).toBe('******7890');
    });

    it('should mask with custom visible chars', () => {
      expect(EncryptionService.mask('1234567890', 2)).toBe('********90');
    });

    it('should mask short values completely', () => {
      expect(EncryptionService.mask('12', 4)).toBe('**');
    });

    it('should handle empty string', () => {
      expect(EncryptionService.mask('')).toBe('');
    });
  });
});
