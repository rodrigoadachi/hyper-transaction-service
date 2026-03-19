import { createRedisClient, REDIS_CLIENT } from './redis.provider';
import { Redis } from 'ioredis';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({ connected: true })),
  };
});

describe('redis.provider', () => {
  beforeEach(() => {
    (Redis as unknown as jest.Mock).mockClear();
  });

  describe('REDIS_CLIENT', () => {
    it('should be a Symbol', () => {
      expect(typeof REDIS_CLIENT).toBe('symbol');
    });
  });

  describe('createRedisClient', () => {
    it('should create a Redis client with required BullMQ settings', () => {
      const config = { host: 'localhost', port: 6379 };

      createRedisClient(config);

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        }),
      );
    });

    it('should pass username and password when provided', () => {
      const config = {
        host: 'redis-host',
        port: 6380,
        username: 'user',
        password: 'secret',
      };

      createRedisClient(config);

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'user',
          password: 'secret',
        }),
      );
    });
  });
});
