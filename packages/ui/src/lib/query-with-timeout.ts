const QUERY_TIMEOUT_MS = 4_000;

export async function queryWithTimeout<T>(query: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} request timed out`));
    }, QUERY_TIMEOUT_MS);

    query
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
