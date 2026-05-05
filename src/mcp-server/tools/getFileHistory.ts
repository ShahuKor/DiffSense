import { Octokit } from '@octokit/rest';
import { getFileCommitHistory } from '../../github/client';

export const getFileHistoryTool = {
  name: 'get_file_history',
  description: 'Return the last N commits that touched a specific file — provides blame and churn context.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to get commit history for' },
      limit: { type: 'number', description: 'Number of commits to return (default 10)', default: 10 },
    },
    required: ['path'],
  },
} as const;

export async function getFileHistory(
  input: { path: string; limit?: number },
  ctx: { octokit: Octokit; owner: string; repo: string }
): Promise<{ sha: string; message: string; date: string }[]> {
  return getFileCommitHistory(ctx.octokit, ctx.owner, ctx.repo, input.path, input.limit ?? 10);
}
