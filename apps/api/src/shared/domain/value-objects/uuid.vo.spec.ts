import { UuidVO } from './uuid.vo';

describe('UuidVO', () => {
  describe('generate()', () => {
    it('should generate a valid UUIDv7', () => {
      const uuid = UuidVO.generate();
      expect(uuid).toBeInstanceOf(UuidVO);
      expect(uuid.toString()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique values', () => {
      const a = UuidVO.generate();
      const b = UuidVO.generate();
      expect(a.toString()).not.toBe(b.toString());
    });
  });

  describe('fromString()', () => {
    it('should accept a valid UUIDv7 string', () => {
      const raw = '01945cf0-0000-7000-8000-000000000001';
      const uuid = UuidVO.fromString(raw);
      expect(uuid.toString()).toBe(raw);
    });

    it('should throw on invalid UUID string', () => {
      expect(() => UuidVO.fromString('not-a-uuid')).toThrow(/Invalid UUIDv7/);
    });

    it('should throw on UUIDv4 (wrong version)', () => {
      expect(() => UuidVO.fromString('550e8400-e29b-41d4-a716-446655440000')).toThrow(/Invalid UUIDv7/);
    });
  });

  describe('equals()', () => {
    it('should return true for the same value', () => {
      const raw = '01945cf0-0000-7000-8000-000000000001';
      const a = UuidVO.fromString(raw);
      const b = UuidVO.fromString(raw);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different values', () => {
      const a = UuidVO.generate();
      const b = UuidVO.generate();
      expect(a.equals(b)).toBe(false);
    });
  });
});
