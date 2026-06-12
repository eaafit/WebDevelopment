import { retryWithBackoff } from './bitrix-orders-retry.helper';

describe('retryWithBackoff', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns result on first success without retry', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(retryWithBackoff(fn, { isRetriable: () => true })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success when error is retriable', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn, { isRetriable: () => true });
    await jest.advanceTimersByTimeAsync(1000); // backoff after attempt 1
    await jest.advanceTimersByTimeAsync(3000); // backoff after attempt 2

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws original error when isRetriable returns false on first failure', async () => {
    const err = new Error('non-retriable');
    const fn = jest.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn, { isRetriable: () => false })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops after maxAttempts and re-throws last error', async () => {
    const err = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn, { isRetriable: () => true, maxAttempts: 3 });
    promise.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(3000);

    await expect(promise).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects exponential backoff multiplier (1s, 3s, 9s with defaults)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('x'));
    const promise = retryWithBackoff(fn, { isRetriable: () => true, maxAttempts: 4 });
    promise.catch(() => undefined);

    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(3000);
    expect(fn).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(9000);
    expect(fn).toHaveBeenCalledTimes(4);
    await expect(promise).rejects.toBeDefined();
  });

  it('calls onRetry callback with attempt number and error', async () => {
    const onRetry = jest.fn();
    const err = new Error('x');
    const fn = jest.fn().mockRejectedValueOnce(err).mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn, { isRetriable: () => true, onRetry });
    await jest.advanceTimersByTimeAsync(1000);
    await promise;

    expect(onRetry).toHaveBeenCalledWith(1, err);
  });
});
