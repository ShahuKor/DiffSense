import { Octokit } from '@octokit/rest';
import { postInlineComment } from '../../github/client';
import { storeReviewComment } from '../../rag/embed';
import { CommentSeverity } from '../../shared/types';
import { CONFIDENCE_THRESHOLD } from '../../shared/constants';

export const postCommentTool = {
  name: 'post_comment',
  description: 'Post an inline review comment at a specific file path and line number on the PR.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path for the inline comment' },
      line: { type: 'number', description: 'Line number to comment on' },
      severity: {
        type: 'string',
        enum: ['CRITICAL', 'SUGGESTION', 'NITPICK'],
        description: 'Comment severity level',
      },
      body: { type: 'string', description: 'Comment text' },
      confidence: {
        type: 'number',
        description: `Confidence score 0–1. Comments below ${CONFIDENCE_THRESHOLD} will be suppressed.`,
      },
    },
    required: ['path', 'line', 'severity', 'body', 'confidence'],
  },
} as const;

export async function postComment(
  input: { path: string; line: number; severity: CommentSeverity; body: string; confidence: number },
  ctx: { octokit: Octokit; owner: string; repo: string; prNumber: number; headSha: string; repoFullName: string }
): Promise<{ posted: boolean; reason?: string }> {
  if (input.confidence < CONFIDENCE_THRESHOLD) {
    return { posted: false, reason: `Confidence ${input.confidence} below threshold ${CONFIDENCE_THRESHOLD}` };
  }

  const formattedBody = `**[${input.severity}]** ${input.body}`;
  await postInlineComment(
    ctx.octokit,
    ctx.owner,
    ctx.repo,
    ctx.prNumber,
    ctx.headSha,
    input.path,
    input.line,
    formattedBody
  );

  await storeReviewComment({
    repoFullName: ctx.repoFullName,
    filePath: input.path,
    commentText: input.body,
    patternType: severityToPatternType(input.severity),
  });

  return { posted: true };
}

function severityToPatternType(severity: CommentSeverity): string {
  if (severity === 'CRITICAL') return 'bug';
  if (severity === 'SUGGESTION') return 'logic';
  return 'style';
}
