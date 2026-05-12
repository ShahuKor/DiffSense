import { prisma } from '../db/client';
import { embedText } from './embed';

interface SimilarReview {
  commentText: string;
  patternType: string;
  feedbackWeight: number;
}

export async function searchSimilarReviews(
  query: string,
  repoFullName: string,
  limit = 5,
): Promise<SimilarReview[]> {
  const embedding = await embedText(query);
  const vectorLiteral = `[${embedding.join(',')}]`;

  // Cosine distance via pgvector <=> operator.
  // Divide by feedback_weight so dismissed patterns (low weight) rank lower.
  const rows = await prisma.$queryRawUnsafe<SimilarReview[]>(
    `SELECT
       comment_text    AS "commentText",
       pattern_type    AS "patternType",
       feedback_weight AS "feedbackWeight"
     FROM review_comments
     WHERE repo_full_name = $1
       AND embedding IS NOT NULL
     ORDER BY (embedding <=> $2::vector) / NULLIF(feedback_weight, 0) ASC
     LIMIT $3`,
    repoFullName,
    vectorLiteral,
    limit,
  );

  return rows;
}
