// src/modules/employee/__tests__/device.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from '../services/device.service';
import { DeviceRepository } from '../repositories/device.repository';
import { TenantContext } from '../../../common/context/tenant.context';
import {
  ResourceNotFoundException,
  DeviceAlreadyRegisteredException,
  DeviceLimitReachedException,
  DeviceBelongsToOtherEmployeeException,
} from '../../../common/exceptions/business-exceptions';
import { EmployeeDevice } from '../../../database/schema/employee-devices';

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID   = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const EMP_ID      = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const OTHER_EMP   = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const DEVICE_FP   = 'ios_AABBCCDDEEFF';          // client fingerprint
const RECORD_ID   = 'dddddddd-dddd-4ddd-dddd-dddddddddddd'; // internal UUID

function makeDevice(overrides: Partial<EmployeeDevice> = {}): EmployeeDevice {
  return {
    id: RECORD_ID,
    tenantId: TENANT_ID,
    employeeId: EMP_ID,
    deviceId: DEVICE_FP,
    deviceName: "Alice's iPhone",
    deviceOs: 'ios',
    fcmToken: 'fcm_token_abc',
    isActive: true,
    registeredAt: new Date('2025-01-01T00:00:00Z'),
    lastUsedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByDeviceId: jest.fn(),
  findByDeviceIdAndEmployee: jest.fn(),
  findByEmployee: jest.fn(),
  countActiveByEmployee: jest.fn(),
  update: jest.fn(),
  touchLastUsed: jest.fn(),
  deactivateAllForEmployee: jest.fn(),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        { provide: DeviceRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
  });

  async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
    return TenantContext.run({ tenantId: TENANT_ID }, fn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // registerDevice
  // ───────────────────────────────────────────────────────────────────────────

  describe('registerDevice', () => {
    const dto = {
      deviceId: DEVICE_FP,
      deviceName: "Alice's iPhone",
      deviceOs: 'ios' as const,
      fcmToken: 'fcm_token_abc',
    };

    it('should register a new device successfully', async () => {
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(null); // not owned by this emp
      mockRepo.findByDeviceId.mockResolvedValue(null);            // not owned by anyone
      mockRepo.countActiveByEmployee.mockResolvedValue(0);
      mockRepo.create.mockResolvedValue(makeDevice());

      const result = await withTenant(() =>
        service.registerDevice(EMP_ID, dto),
      );

      expect(result.deviceId).toBe(DEVICE_FP);
      expect(result.isActive).toBe(true);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          employeeId: EMP_ID,
          deviceId: DEVICE_FP,
        }),
      );
    });

    it('should be idempotent: re-registering an active device refreshes FCM token', async () => {
      const existing = makeDevice({ fcmToken: 'old_token' });
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(existing);
      const updated = makeDevice({ fcmToken: 'new_token' });
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.registerDevice(EMP_ID, { ...dto, fcmToken: 'new_token' }),
      );

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith(
        RECORD_ID,
        EMP_ID,
        TENANT_ID,
        expect.objectContaining({ fcmToken: 'new_token' }),
      );
    });

    it('should be idempotent: re-registering same FCM token returns current state', async () => {
      const existing = makeDevice({ fcmToken: 'fcm_token_abc' });
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(existing);

      const result = await withTenant(() =>
        service.registerDevice(EMP_ID, dto),
      );

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(result.deviceId).toBe(DEVICE_FP);
    });

    it('should reactivate a previously deactivated device', async () => {
      const deactivated = makeDevice({ isActive: false });
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(deactivated);
      const reactivated = makeDevice({ isActive: true });
      mockRepo.update.mockResolvedValue(reactivated);

      const result = await withTenant(() =>
        service.registerDevice(EMP_ID, dto),
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        RECORD_ID,
        EMP_ID,
        TENANT_ID,
        expect.objectContaining({ isActive: true }),
      );
      expect(result.isActive).toBe(true);
    });

    it('should throw DeviceBelongsToOtherEmployeeException when device is active on another employee', async () => {
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(null); // not this emp
      mockRepo.findByDeviceId.mockResolvedValue(
        makeDevice({ employeeId: OTHER_EMP }), // active on another emp
      );

      await expect(
        withTenant(() => service.registerDevice(EMP_ID, dto)),
      ).rejects.toThrow(DeviceBelongsToOtherEmployeeException);
    });

    it('should allow re-registration when device was deactivated on another employee', async () => {
      // Same physical device, inactive on another employee — allowed
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(null);
      mockRepo.findByDeviceId.mockResolvedValue(
        makeDevice({ employeeId: OTHER_EMP, isActive: false }),
      );
      mockRepo.countActiveByEmployee.mockResolvedValue(1);
      mockRepo.create.mockResolvedValue(makeDevice());

      const result = await withTenant(() =>
        service.registerDevice(EMP_ID, dto),
      );

      expect(result.deviceId).toBe(DEVICE_FP);
    });

    it('should throw DeviceLimitReachedException when at the 5-device limit', async () => {
      mockRepo.findByDeviceIdAndEmployee.mockResolvedValue(null);
      mockRepo.findByDeviceId.mockResolvedValue(null);
      mockRepo.countActiveByEmployee.mockResolvedValue(5); // at limit

      await expect(
        withTenant(() => service.registerDevice(EMP_ID, dto)),
      ).rejects.toThrow(DeviceLimitReachedException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // listDevices
  // ───────────────────────────────────────────────────────────────────────────

  describe('listDevices', () => {
    it('should return all active devices for the employee', async () => {
      const devices = [makeDevice(), makeDevice({ id: 'other-id', deviceId: 'android_XYZ' })];
      mockRepo.findByEmployee.mockResolvedValue(devices);

      const result = await withTenant(() => service.listDevices(EMP_ID));

      expect(result).toHaveLength(2);
      // FCM token must NOT be in the response
      result.forEach((d) => expect(d).not.toHaveProperty('fcmToken'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // updateFcmToken
  // ───────────────────────────────────────────────────────────────────────────

  describe('updateFcmToken', () => {
    it('should update the FCM token successfully', async () => {
      mockRepo.findById.mockResolvedValue(makeDevice());
      const updated = makeDevice({ fcmToken: 'new_fcm_token' });
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.updateFcmToken(RECORD_ID, EMP_ID, {
          fcmToken: 'new_fcm_token',
        }),
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        RECORD_ID,
        EMP_ID,
        TENANT_ID,
        { fcmToken: 'new_fcm_token' },
      );
    });

    it('should throw ResourceNotFoundException when device not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        withTenant(() =>
          service.updateFcmToken(RECORD_ID, EMP_ID, {
            fcmToken: 'token',
          }),
        ),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateDevice
  // ───────────────────────────────────────────────────────────────────────────

  describe('deactivateDevice', () => {
    it('should deactivate an active device', async () => {
      mockRepo.findById.mockResolvedValue(makeDevice({ isActive: true }));
      mockRepo.update.mockResolvedValue(makeDevice({ isActive: false }));

      await withTenant(() => service.deactivateDevice(RECORD_ID, EMP_ID));

      expect(mockRepo.update).toHaveBeenCalledWith(
        RECORD_ID,
        EMP_ID,
        TENANT_ID,
        { isActive: false },
      );
    });

    it('should be idempotent when device is already inactive', async () => {
      mockRepo.findById.mockResolvedValue(makeDevice({ isActive: false }));

      await withTenant(() => service.deactivateDevice(RECORD_ID, EMP_ID));

      // No update needed
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should throw ResourceNotFoundException when device not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        withTenant(() => service.deactivateDevice(RECORD_ID, EMP_ID)),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateAllForEmployee
  // ───────────────────────────────────────────────────────────────────────────

  describe('deactivateAllForEmployee', () => {
    it('should deactivate all devices on termination', async () => {
      mockRepo.deactivateAllForEmployee.mockResolvedValue(3);

      await withTenant(() => service.deactivateAllForEmployee(EMP_ID));

      expect(mockRepo.deactivateAllForEmployee).toHaveBeenCalledWith(
        EMP_ID,
        TENANT_ID,
      );
    });

    it('should not throw when the employee has no devices', async () => {
      mockRepo.deactivateAllForEmployee.mockResolvedValue(0);

      await expect(
        withTenant(() => service.deactivateAllForEmployee(EMP_ID)),
      ).resolves.not.toThrow();
    });
  });
});
