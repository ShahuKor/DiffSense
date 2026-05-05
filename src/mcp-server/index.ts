import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import { readFileTool, readFile } from './tools/readFile';
import { getDiffTool, getDiff } from './tools/getDiff';
import { searchReviewsTool, searchReviews } from './tools/searchReviews';
import { getFileHistoryTool, getFileHistory } from './tools/getFileHistory';
import { postCommentTool, postComment } from './tools/postComment';
import { postSummaryTool, postSummary } from './tools/postSummary';
import { getPrMetadataTool, getPrMetadata } from './tools/getPrMetadata';

export interface ToolContext {
  octokit: Octokit;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  repoFullName: string;
}

const TOOL_DEFINITIONS = [
  readFileTool,
  getDiffTool,
  searchReviewsTool,
  getFileHistoryTool,
  postCommentTool,
  postSummaryTool,
  getPrMetadataTool,
] as const;

export async function getMcpTools(): Promise<Anthropic.Tool[]> {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }));
}

export async function executeMcpTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'read_file':
      return readFile(input as { path: string }, ctx);

    case 'get_diff':
      return getDiff(input as { path: string }, ctx);

    case 'search_reviews':
      return searchReviews(input as { query: string; limit?: number }, ctx);

    case 'get_file_history':
      return getFileHistory(input as { path: string; limit?: number }, ctx);

    case 'post_comment':
      return postComment(input as Parameters<typeof postComment>[0], ctx);

    case 'post_summary':
      return postSummary(input as Parameters<typeof postSummary>[0], ctx);

    case 'get_pr_metadata':
      return getPrMetadata({} as Record<string, never>, ctx);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
