import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import { GITHUB_EVENTS, PULL_REQUEST_ACTIONS, REVIEW_QUEUE_NAME } from '../shared/constants';
import { PrReviewJobPayload } from '../shared/types';
import { logger } from '../shared/logger';
import { getRedisConnection } from '../worker/index';

function verifySignature(secret: string, payload: Buffer, signature: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
}

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const event = req.headers['x-github-event'] as string | undefined;
  const rawBody = (req as Request & { rawBody: Buffer }).rawBody;

  if (!signature || !event) {
    res.status(400).json({ error: 'Missing signature or event header' });
    return;
  }

  const isValid = verifySignature(process.env.GITHUB_WEBHOOK_SECRET!, rawBody, signature);
  if (!isValid) {
    logger.warn('Invalid webhook signature', { event });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = JSON.parse(rawBody.toString('utf-8'));

  if (event === GITHUB_EVENTS.PULL_REQUEST) {
    await handlePullRequestEvent(payload);
  } else if (event === GITHUB_EVENTS.PR_REVIEW_COMMENT) {
    await handleReviewCommentEvent(payload);
  } else {
    logger.debug('Ignoring unhandled event', { event });
  }

  res.status(200).json({ ok: true });
}

async function handlePullRequestEvent(payload: Record<string, unknown>): Promise<void> {
  const action = payload['action'] as string;
  if (!(PULL_REQUEST_ACTIONS as readonly string[]).includes(action)) return;

  const pr = payload['pull_request'] as Record<string, unknown>;
  const repo = payload['repository'] as Record<string, unknown>;
  const installation = payload['installation'] as Record<string, unknown>;

  const job: PrReviewJobPayload = {
    prId: pr['node_id'] as string,
    repoFullName: repo['full_name'] as string,
    prNumber: pr['number'] as number,
    installationId: installation['id'] as number,
    headSha: (pr['head'] as Record<string, unknown>)['sha'] as string,
  };

  const queue = new Queue<PrReviewJobPayload>(REVIEW_QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  await queue.add('review', job, { removeOnComplete: true, removeOnFail: 1000 });
  await queue.close();

  logger.info('Queued PR review job', { repo: job.repoFullName, pr: job.prNumber });
}

async function handleReviewCommentEvent(payload: Record<string, unknown>): Promise<void> {
  const action = payload['action'] as string;
  if (action !== 'created') return;

  // TODO (Week 6): record feedback signal for dismissed/resolved comments
  logger.debug('Review comment event received', { action });
}
