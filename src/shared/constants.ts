export const REVIEW_QUEUE_NAME = 'pr-review';

export const MAX_FILES_DEEP_REVIEW = 8;

export const CONFIDENCE_THRESHOLD = 0.7;

export const EMBEDDING_DIMENSIONS = 1536;

export const CLAUDE_MODEL = 'claude-sonnet-4-5';

export const GITHUB_EVENTS = {
  PULL_REQUEST: 'pull_request',
  PR_REVIEW_COMMENT: 'pull_request_review_comment',
  PR_REVIEW_THREAD: 'pull_request_review_thread',
} as const;

export const FEEDBACK_WEIGHT_INCREASE = 0.1;
export const FEEDBACK_WEIGHT_DECREASE = 0.15;
export const FEEDBACK_WEIGHT_MIN = 0.1;
export const FEEDBACK_WEIGHT_MAX = 1.0;

export const PULL_REQUEST_ACTIONS = ['opened', 'synchronize', 'reopened'] as const;
