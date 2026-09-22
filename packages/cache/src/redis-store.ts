import Redis from 'ioredis';
import { ICacheStore } from './types';

/**
 * L2 Redis Cache Store.
 * Supports:
 * 1. Native Redis TCP connection via `REDIS_URL` (using high-performance ioredis)
 * 2. HTTP REST Redis via `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`
 *
 * Zero-Crash Guarantee:
 * If Redis is not configured or fails, it logs once and gracefully returns null/false,
 * falling back to L1 In-Memory Cache and Supabase database without throwing.
 */
export class RedisStore implements ICacheStore {
  private client: Redis | null = null;
  private restUrl: string | null = null;
  private restToken: string | null = null;
  private hasWarnedMissingConfig = false;
  private isTemporarilyDisabled = false;
  private lastFailureTime = 0;
  private readonly FAILURE_COOLDOWN_MS = 30000; // 30s cooldown after connection failure

  constructor(redisUrl?: string, restUrl?: string, restToken?: string) {
    const connStr = redisUrl || process.env.REDIS_URL;
    this.restUrl = restUrl || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || null;
    this.restToken = restToken || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || null;

    if (connStr) {
      try {
        this.client = new Redis(connStr, {
          connectTimeout: 5000,
          commandTimeout: 3000,
          maxRetriesPerRequest: 2,
          enableOfflineQueue: true,
          lazyConnect: true,
        });

        this.client.on('error', (err: any) => {
          if (!this.isTemporarilyDisabled) {
            console.warn(`[RedisStore] Redis TCP error (${err?.message || err}). Enabling ${this.FAILURE_COOLDOWN_MS / 1000}s cooldown.`);
            this.isTemporarilyDisabled = true;
            this.lastFailureTime = Date.now();
          }
        });
      } catch (err: any) {
        console.warn('[RedisStore] Failed to initialize Redis client:', err?.message || err);
      }
    }
  }

  private async ensureConnected(): Promise<boolean> {
    if (!this.client) return false;
    if (this.client.status === 'ready') return true;
    if (this.client.status === 'connecting' || this.client.status === 'connect') {
      return true;
    }
    try {
      await this.client.connect();
      return true;
    } catch (err: any) {
      this.handleError('connect', err);
      return false;
    }
  }

  /**
   * Check if Redis (TCP or REST) is configured and not in cooldown.
   */
  isAvailable(): boolean {
    if (this.isTemporarilyDisabled) {
      if (Date.now() - this.lastFailureTime > this.FAILURE_COOLDOWN_MS) {
        this.isTemporarilyDisabled = false;
      } else {
        return false;
      }
    }

    if (this.client) return true;
    if (this.restUrl && this.restToken) return true;

    if (!this.hasWarnedMissingConfig) {
      console.info('[RedisStore] No Redis credentials found (REDIS_URL or UPSTASH_REDIS_REST_URL). Operating in L1 Memory-only mode.');
      this.hasWarnedMissingConfig = true;
    }
    return false;
  }

  /**
   * Retrieves an item from Redis.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      let raw: string | null = null;

      if (this.client) {
        if (!(await this.ensureConnected())) return null;
        raw = await this.client.get(key);
      } else if (this.restUrl && this.restToken) {
        raw = await this.executeRestCommand<string>(['GET', key]);
      }

      if (!raw) return null;

      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err: any) {
      this.handleError('GET', err);
      return null;
    }
  }

  /**
   * Stores an item in Redis with TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.client) {
        if (!(await this.ensureConnected())) return;
        if (ttlSeconds > 0) {
          await this.client.set(key, serialized, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, serialized);
        }
      } else if (this.restUrl && this.restToken) {
        const cmd = ttlSeconds > 0 ? ['SET', key, serialized, 'EX', ttlSeconds] : ['SET', key, serialized];
        await this.executeRestCommand(cmd);
      }
    } catch (err: any) {
      this.handleError('SET', err);
    }
  }

  /**
   * Deletes a specific key from Redis.
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      let result = 0;
      if (this.client) {
        if (!(await this.ensureConnected())) return false;
        result = await this.client.del(key);
      } else if (this.restUrl && this.restToken) {
        result = (await this.executeRestCommand<number>(['DEL', key])) ?? 0;
      }
      return result > 0;
    } catch (err: any) {
      this.handleError('DEL', err);
      return false;
    }
  }

  /**
   * Deletes all keys matching a pattern (e.g. 'suka:menu:*').
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      if (this.client) {
        if (!(await this.ensureConnected())) return 0;
        const keys = await this.client.keys(pattern);
        if (keys.length === 0) return 0;
        return await this.client.del(...keys);
      } else if (this.restUrl && this.restToken) {
        const keys = await this.executeRestCommand<string[]>(['KEYS', pattern]);
        if (!keys || keys.length === 0) return 0;
        const deleted = await this.executeRestCommand<number>(['DEL', ...keys]);
        return deleted ?? 0;
      }
      return 0;
    } catch (err: any) {
      this.handleError('deletePattern', err);
      return 0;
    }
  }

  /**
   * Flushes Redis database (use with care).
   */
  async clear(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      if (this.client) {
        if (!(await this.ensureConnected())) return;
        await this.client.flushdb();
      } else if (this.restUrl && this.restToken) {
        await this.executeRestCommand(['FLUSHDB']);
      }
    } catch (err: any) {
      this.handleError('FLUSHDB', err);
    }
  }

  /**
   * Closes the connection gracefully.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
  }

  private async executeRestCommand<T = any>(command: any[]): Promise<T | null> {
    const response = await fetch(this.restUrl!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) return null;
    const json = await response.json();
    return json.result as T;
  }

  private handleError(operation: string, err: any): void {
    console.warn(`[RedisStore] Redis error during ${operation} (${err?.message || err}). Enabling cooldown.`);
    this.isTemporarilyDisabled = true;
    this.lastFailureTime = Date.now();
  }
}

export const redisStore = new RedisStore();
