/** Inline validation error shown under a field. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

/** Extracts a field-level message from an express-validator errors array. */
export function fieldError(
  errors: Array<{ path: string; msg: string }> | undefined,
  path: string
): string | undefined {
  return errors?.find((e) => e.path === path)?.msg;
}

/** Extracts a top-level error message from either { error: string } or { errors: [...] }. */
export function parseServerError(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';
  const e = err as { message?: string };
  return e.message ?? 'An unexpected error occurred.';
}
