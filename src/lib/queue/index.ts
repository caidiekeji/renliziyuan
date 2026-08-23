import { Queue, Worker } from 'bullmq';
import { ensureRedis } from '@/lib/db/redis';
import { getSiteConfig } from '@/lib/config';
import { log } from '@/lib/logger';

export const Q = {
  recalcRating: 'recalc-rating',
  recycleJobs: 'recycle-jobs',
  notifications: 'notifications',
} as const;

const queues: Record<string, Queue> = {};

function getQueue(name: string): Queue {
  if (!queues[name]) queues[name] = new Queue(name, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } });
  return queues[name];
}

export async function getQueueConfig() {
  const cfg = await getSiteConfig();
  return { attempts: cfg.queue_attempts, backoff: cfg.queue_backoff_ms, dlq: cfg.queue_dlq_enabled };
}

async function addJob(name: string, data: unknown, opts: { jobId?: string; delayMs?: number } = {}) {
  const cfg = await getQueueConfig();
  const q = getQueue(name);
  const id = await q.add(name, data, {
    attempts: cfg.attempts,
    backoff: { type: 'exponential', delay: cfg.backoff },
    jobId: opts.jobId,
    delay: opts.delayMs,
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: cfg.dlq ? undefined : { age: 3600, count: 1000 },
  });
  return id;
}

/** 队列添加：评分重算、配额回收、通知（jobId 不允许包含冒号） */
export const enqueue = {
  recalcRating: (companyId: string) => addJob(Q.recalcRating, { companyId }, { jobId: `rating-${companyId}` }),
  recycleJobs: (companyId: string, planId: string) =>
    addJob(Q.recycleJobs, { companyId, planId }, { jobId: `recycle-${companyId}` }),
  notify: (payload: unknown) => addJob(Q.notifications, payload),
};

export type WorkerContext = { name: string; attempts: number; backoff: number };

export async function getWorkerCtx(): Promise<WorkerContext> {
  const cfg = await getQueueConfig();
  return { name: 'default', attempts: cfg.attempts, backoff: cfg.backoff };
}

export function createWorker(name: string, handler: (data: any) => Promise<void>) {
  const worker = new Worker(name, async (job) => {
    const start = Date.now();
    try {
      await handler(job.data);
      log('info', `queue:${name}:done`, { jobId: job.id, ms: Date.now() - start });
    } catch (e: any) {
      log('error', `queue:${name}:failed`, { jobId: job.id, attempts: job.attemptsMade, error: e?.message });
      // 达到最大重试仍失败 → 进入 DLQ（失败保留，由 DLQ 处理器人工处置）
      if (job.attemptsMade >= (job.opts?.attempts || 3)) {
        await ensureRedis().then((r) => r.sadd('dlq:jobs', JSON.stringify({ name, id: job.id, data: job.data, failedAt: new Date().toISOString(), error: e?.message })));
      }
      throw e;
    }
  }, { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' }, concurrency: 5 });

  worker.on('failed', (job, err) => log('error', `queue:${name}:on-failed`, { jobId: job?.id, error: err?.message }));
  return worker;
}
