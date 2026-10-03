export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  multiplier?: number;
  isRetriable: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  const multiplier = opts.multiplier ?? 3;

  let attempt = 0;
  let delay = baseDelay;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts || !opts.isRetriable(error)) {
        throw error;
      }
      opts.onRetry?.(attempt, error);
      await sleep(delay);
      delay *= multiplier;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}