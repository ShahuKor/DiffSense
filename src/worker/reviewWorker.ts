import { PrReviewJobPayload } from '../shared/types';
import { prisma } from '../db/client';
import { logger } from '../shared/logger';
import { runReviewAgent } from '../agent/index';

export async function processReviewJob(payload: PrReviewJobPayload): Promise<void> {
  const job = await prisma.reviewJob.create({
    data: {
      prId: payload.prId,
      repoFullName: payload.repoFullName,
      prNumber: payload.prNumber,
      installationId: payload.installationId,
      headSha: payload.headSha,
      status: 'processing',
    },
  });

  try {
    await runReviewAgent(payload);

    await prisma.reviewJob.update({
      where: { id: job.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Agent failed', { jobId: job.id, error: message });

    await prisma.reviewJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: message, completedAt: new Date() },
    });

    throw err;
  }
}
