import OpenAI from 'openai';
import { FeedbackType } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../shared/logger';
import {
  FEEDBACK_WEIGHT_INCREASE,
  FEEDBACK_WEIGHT_DECREASE,
  FEEDBACK_WEIGHT_MIN,
  FEEDBACK_WEIGHT_MAX,
} from '../shared/constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return data[0].embedding;
}

export interface StoreCommentInput {
  repoFullName: string;
  filePath: string;
  commentText: string;
  patternType: string;
  githubCommentId?: number;
}

export async function storeReviewComment(input: StoreCommentInput): Promise<void> {
  try {
    const embedding = await embedText(input.commentText);
    const vectorLiteral = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO review_comments (id, repo_full_name, file_path, pattern_type, comment_text, embedding, github_comment_id, feedback_weight)
       VALUES (gen_random_uuid(), $1, $2, $3::"PatternType", $4, $5::vector, $6, 0.5)`,
      input.repoFullName,
      input.filePath,
      input.patternType,
      input.commentText,
      vectorLiteral,
      input.githubCommentId ?? null,
    );
  } catch (err) {
    logger.warn('Failed to store review comment embedding', { error: err });
  }
}

export async function updateCommentFeedback(
  githubCommentId: number,
  feedback: 'accepted' | 'dismissed',
): Promise<void> {
  const comment = await prisma.reviewComment.findFirst({
    where: { githubCommentId: BigInt(githubCommentId) },
    select: { id: true, feedbackWeight: true },
  });

  if (!comment) {
    logger.debug('No matching review comment for feedback signal', { githubCommentId });
    return;
  }

  const delta = feedback === 'accepted' ? FEEDBACK_WEIGHT_INCREASE : -FEEDBACK_WEIGHT_DECREASE;
  const newWeight = Math.min(FEEDBACK_WEIGHT_MAX, Math.max(FEEDBACK_WEIGHT_MIN, comment.feedbackWeight + delta));

  await prisma.reviewComment.update({
    where: { id: comment.id },
    data: {
      feedback: feedback as FeedbackType,
      feedbackWeight: newWeight,
    },
  });

  logger.info('Updated comment feedback weight', { githubCommentId, feedback, newWeight });
}
