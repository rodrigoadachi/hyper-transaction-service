import { RedisTransactionCacheService } from './redis-transaction-cache.service';

const makeMockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
});

describe('RedisTransactionCacheService', () => {
  let service: RedisTransactionCacheService;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    redis = makeMockRedis();
    service = new RedisTransactionCacheService(redis as never);
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const data = { id: '123', amount: 100 };
      redis.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.get<typeof data>('some-key');

      expect(result).toEqual(data);
      expect(redis.get).toHaveBeenCalledWith('some-key');
    });

    it('should return null when key does not exist', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize value and store with EX ttl', async () => {
      redis.set.mockResolvedValue('OK');
      const value = { foo: 'bar' };

      await service.set('cache-key', value, 30);

      expect(redis.set).toHaveBeenCalledWith(
        'cache-key',
        JSON.stringify(value),
        'EX',
        30,
      );
    });
  });

  describe('invalidatePattern', () => {
    it('should scan and delete keys matching the pattern', async () => {
      redis.scan
        .mockResolvedValueOnce(['0', ['key:1', 'key:2']])
      redis.del.mockResolvedValue(2);

      await service.invalidatePattern('key:*');

      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'key:*', 'COUNT', 100);
      expect(redis.del).toHaveBeenCalledWith('key:1', 'key:2');
    });

    it('should iterate until cursor is 0', async () => {
      redis.scan
        .mockResolvedValueOnce(['42', ['key:1']])
        .mockResolvedValueOnce(['0', ['key:2']]);
      redis.del.mockResolvedValue(1);

      await service.invalidatePattern('key:*');

      expect(redis.scan).toHaveBeenCalledTimes(2);
      expect(redis.del).toHaveBeenCalledTimes(2);
    });

    it('should not call del when scan returns no keys', async () => {
      redis.scan.mockResolvedValueOnce(['0', []]);

      await service.invalidatePattern('empty:*');

      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
