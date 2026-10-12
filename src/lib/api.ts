export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      503,
      'Сервер пространства ещё не настроен или недоступен. Локальное редактирование отключено.',
    );
  }
  if (!response.ok)
    throw new ApiError(response.status, result.error || 'Не удалось выполнить запрос');
  return result as T;
}
