import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db/client';
import { EMBEDDING_DIMENSIONS } from '../shared/constants';
import { logger } from '../shared/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  // Anthropic doesn't yet expose a public embeddings endpoint —
  // swap this for OpenAI text-embedding-3-small if needed.
  // See: https://platform.openai.com/docs/api-reference/embeddings
  throw new Error(
    'Embedding provider not configured. Set up OpenAI embeddings or wait for Anthropic embeddings API.'
  );
  // Example OpenAI implementation:
  // const openai = new OpenAI();
  // const { data } = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  // return data[0].embedding;
}

export interface StoreCommentInput {
  repoFullName: string;
  filePath: string;
  commentText: string;
  patternType: string;
}

export async function storeReviewComment(input: StoreCommentInput): Promise<void> {
  try {
    const embedding = await embedText(input.commentText);

    // pgvector raw insert — Prisma doesn't support vector type natively yet
    await prisma.$executeRaw`
      INSERT INTO review_comments (id, repo_full_name, file_path, pattern_type, comment_text, embedding, feedback_weight)
      VALUES (
        gen_random_uuid(),
        ${input.repoFullName},
        ${input.filePath},
        ${input.patternType}::"PatternType",
        ${input.commentText},
        ${`[${embedding.join(',')}]`}::vector(${EMBEDDING_DIMENSIONS}),
        0.5
      )
    `;
  } catch (err) {
    logger.warn('Failed to store review comment embedding', { error: err });
  }
}
