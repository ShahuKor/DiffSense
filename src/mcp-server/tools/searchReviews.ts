import { searchSimilarReviews } from '../../rag/search';

export const searchReviewsTool = {
  name: 'search_reviews',
  description:
    'Vector similarity search over past review comments. Given a code snippet, returns historically similar feedback from this repo.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Code snippet or description to search for similar past reviews' },
      limit: { type: 'number', description: 'Max results to return (default 5)', default: 5 },
    },
    required: ['query'],
  },
} as const;

export async function searchReviews(
  input: { query: string; limit?: number },
  ctx: { repoFullName: string }
): Promise<{ commentText: string; patternType: string; feedbackWeight: number }[]> {
  return searchSimilarReviews(input.query, ctx.repoFullName, input.limit ?? 5);
}
