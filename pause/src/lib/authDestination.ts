/** Only local paths may be used after authentication. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  return value;
}