import Anthropic from '@anthropic-ai/sdk';
import { PrReviewJobPayload } from '../shared/types';
import { CLAUDE_MODEL, MAX_FILES_DEEP_REVIEW, CONFIDENCE_THRESHOLD } from '../shared/constants';
import { logger } from '../shared/logger';
import { getInstallationOctokit, getPrFiles } from '../github/client';
import { getMcpTools, executeMcpTool } from '../mcp-server/index';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are ReviewBot, an expert code reviewer embedded in a GitHub PR workflow.

Your job is to review Pull Requests thoroughly and post actionable inline comments.

Review process:
1. TRIAGE: Read the file list and diff stats. Use search_reviews to find historically buggy files.
   Select the top ${MAX_FILES_DEEP_REVIEW} files for deep review.
2. DEEP REVIEW: For each selected file, call read_file and get_diff. Reason carefully.
3. COMMENT: Post inline comments using post_comment. Each comment must include severity:
   - CRITICAL: bugs, security issues, data loss — must fix before merge
   - SUGGESTION: quality/logic improvements — should fix
   - NITPICK: style/naming — optional
   Only post comments with confidence >= ${CONFIDENCE_THRESHOLD}. Suppress low-confidence noise.
4. SUMMARY: Call post_summary with overall verdict and list of critical issues.

Be precise, constructive, and match the team's standards from past reviews.`;

export async function runReviewAgent(payload: PrReviewJobPayload): Promise<void> {
  const [owner, repo] = payload.repoFullName.split('/');
  const octokit = await getInstallationOctokit(payload.installationId);

  const files = await getPrFiles(octokit, owner, repo, payload.prNumber);

  const tools = await getMcpTools();
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Please review PR #${payload.prNumber} in ${payload.repoFullName}.

PR head SHA: ${payload.headSha}
Files changed (${files.length}):
${files.map((f) => `- ${f.filename} (+${f.additions}/-${f.deletions})`).join('\n')}

Start with triage, then deep review the most important files, then post your summary.`,
    },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 30;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    logger.debug('Agent iteration', { iteration: iterations, stopReason: response.stop_reason });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        logger.debug('Executing tool', { tool: block.name, input: block.input });

        try {
          const result = await executeMcpTool(block.name, block.input as Record<string, unknown>, {
            octokit,
            owner,
            repo,
            prNumber: payload.prNumber,
            headSha: payload.headSha,
            repoFullName: payload.repoFullName,
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn('Tool execution failed', { tool: block.name, error: message });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    logger.warn('Agent hit max iterations', { pr: payload.prNumber });
  }

  logger.info('Review agent completed', { pr: payload.prNumber, iterations });
}
