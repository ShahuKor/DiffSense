import { Octokit } from '@octokit/rest';
import { postPrReview } from '../../github/client';
import { ReviewVerdict } from '../../shared/types';

export const postSummaryTool = {
  name: 'post_summary',
  description: 'Post a top-level PR review with an overall verdict (APPROVE / REQUEST_CHANGES / COMMENT) and summary.',
  inputSchema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
        description: 'Overall review verdict',
      },
      summary: { type: 'string', description: 'Summary of the review' },
      criticalIssues: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of critical issues found',
      },
    },
    required: ['verdict', 'summary', 'criticalIssues'],
  },
} as const;

export async function postSummary(
  input: { verdict: ReviewVerdict; summary: string; criticalIssues: string[] },
  ctx: { octokit: Octokit; owner: string; repo: string; prNumber: number; headSha: string }
): Promise<void> {
  const criticalSection =
    input.criticalIssues.length > 0
      ? `\n\n**Critical Issues:**\n${input.criticalIssues.map((i) => `- ${i}`).join('\n')}`
      : '';

  const body = `## ReviewBot Summary\n\n${input.summary}${criticalSection}\n\n---\n*Reviewed by ReviewBot*`;

  await postPrReview(ctx.octokit, ctx.owner, ctx.repo, ctx.prNumber, ctx.headSha, body, input.verdict);
}
