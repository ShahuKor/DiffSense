import 'dotenv/config';
import { Worker, ConnectionOptions } from 'bullmq';
import { REVIEW_QUEUE_NAME } from '../shared/constants';
import { PrReviewJobPayload } from '../shared/types';
import { logger } from '../shared/logger';
import { processReviewJob } from './reviewWorker';

export function getRedisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
  };
}

const worker = new Worker<PrReviewJobPayload>(
  REVIEW_QUEUE_NAME,
  async (job) => {
    logger.info('Processing review job', { jobId: job.id, repo: job.data.repoFullName, pr: job.data.prNumber });
    await processReviewJob(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  logger.info('Review job completed', { jobId: job.id });
});

worker.on('failed', (job, err) => {
  logger.error('Review job failed', { jobId: job?.id, error: err.message });
});

logger.info('ReviewBot worker started, waiting for jobs...');
