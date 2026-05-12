import OpenAI from 'openai';
import { prisma } from '../db/client';
import { logger } from '../shared/logger';

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
}

export async function storeReviewComment(input: StoreCommentInput): Promise<void> {
  try {
    const embedding = await embedText(input.commentText);
    const vectorLiteral = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO review_comments (id, repo_full_name, file_path, pattern_type, comment_text, embedding, feedback_weight)
       VALUES (gen_random_uuid(), $1, $2, $3::\"PatternType\", $4, $5::vector, 0.5)`,
      input.repoFullName,
      input.filePath,
      input.patternType,
      input.commentText,
      vectorLiteral,
    );
  } catch (err) {
    logger.warn('Failed to store review comment embedding', { error: err });
  }
}
