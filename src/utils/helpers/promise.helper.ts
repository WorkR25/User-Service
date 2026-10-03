/**
 * Rejects if `promise` does not settle within `ms`. The underlying work is not cancelled,
 * so only use it where late completion is harmless (e.g. an idempotent enqueue).
 */
export const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
};
