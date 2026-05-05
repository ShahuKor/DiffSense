import { prisma } from '../db/client';
import { embedText } from './embed';
import { EMBEDDING_DIMENSIONS } from '../shared/constants';

interface SimilarReview {
  commentText: string;
  patternType: string;
  feedbackWeight: number;
}

export async function searchSimilarReviews(
  query: string,
  repoFullName: string,
  limit = 5
): Promise<SimilarReview[]> {
  const queryEmbedding = await embedText(query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  // Cosine similarity search via pgvector <=> operator, filtered by repo and
  // weighted by feedback_weight so dismissed patterns rank lower.
  const rows = await prisma.$queryRaw<SimilarReview[]>`
    SELECT
      comment_text   AS "commentText",
      pattern_type   AS "patternType",
      feedback_weight AS "feedbackWeight"
    FROM review_comments
    WHERE repo_full_name = ${repoFullName}
    ORDER BY
      (embedding <=> ${vectorLiteral}::vector(${EMBEDDING_DIMENSIONS})) / feedback_weight ASC
    LIMIT ${limit}
  `;

  return rows;
}
