import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

const makeDb = () => ({ execute: jest.fn() });

describe('HealthController', () => {
  let controller: HealthController;
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
    controller = new HealthController(db as never);
  });

  describe('live', () => {
    it('should return status ok with timestamp', () => {
      const result = controller.live();
      expect(result.status).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('ready', () => {
    it('should return status ok when database is reachable', async () => {
      db.execute.mockResolvedValue([]);

      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.checks.database).toBe('ok');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should throw ServiceUnavailableException when database is unreachable', async () => {
      db.execute.mockRejectedValue(new Error('connection refused'));

      await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
