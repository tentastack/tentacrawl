interface ApiClientConfig {
  baseUrl: string;
}

type ErrorBodyItem = { message?: string };

let config: ApiClientConfig = {
  baseUrl: '',
};

function configureApiClient(baseUrl: string) {
  config = { baseUrl: baseUrl.replace(/\/$/, '') };
}

async function parseResponseBody<T>(res: Response): Promise<T | string | ErrorBodyItem[] | { message?: string } | null> {
  if (res.status === 204 || res.status === 205) {
    return null;
  }

  const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    return res.json().catch(() => null);
  }

  const text = await res.text().catch(() => '');
  return text.length > 0 ? text : null;
}

function getErrorMessage(body: string | ErrorBodyItem[] | { message?: string } | null, status: number): string {
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }

  if (Array.isArray(body) && body.length > 0) {
    return body
      .map((item) => item.message)
      .filter((message): message is string => typeof message === 'string' && message.length > 0)
      .join(', ');
  }

  if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  return `Request failed with status ${status}`;
}

async function apiCall<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const url = `${config.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const body = await parseResponseBody<T>(res);

    if (!res.ok) {
      const message = getErrorMessage(body as string | ErrorBodyItem[] | { message?: string } | null, res.status);
      return { data: null, error: message, status: res.status };
    }

    const data = body as T | null;
    return { data, error: null, status: res.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    };
  }
}

async function apiCallOrThrow<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const result = await apiCall<T>(path, options);
  if (result.error) throw new Error(result.error);
  return result.data as T;
}

export { configureApiClient, apiCall, apiCallOrThrow };
