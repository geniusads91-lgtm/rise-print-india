import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retryStrategy: (times) => {
    if (times > 10) {
      return null;
    }
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 3,
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.ping();
  } catch (error) {
    console.warn('⚠️  Redis not available, continuing without caching');
  }
};

// Cache utilities
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (error) {
      console.error('Cache pattern delete error:', error);
    }
  },
};

export default redisClient;
