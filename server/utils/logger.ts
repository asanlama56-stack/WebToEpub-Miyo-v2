export function dlog(tag: string, message: string, meta: Record<string, any> = {}) {
  const time = new Date().toISOString();
  console.log(`[${time}] [IMG-PROC] [${tag}] ${message}`, meta);
}
