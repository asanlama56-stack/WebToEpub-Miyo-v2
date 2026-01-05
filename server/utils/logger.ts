/**
 * A simple logger for the server.
 * It's not super robust, but it gets the job done for this project.
 * It's easy to expand upon if we need more features in the future.
 * @param message The message to log.
 * @param source The source of the log message (e.g., 'express', 'scraper').
 */
export function log(message: string, source = "server") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * A specialized logger for debugging image processing.
 * @param tag A tag to identify the part of the image processing pipeline.
 * @param message The debug message.
 * @param meta Additional metadata to log.
 */
export function dlog(tag: string, message: string, meta: Record<string, any> = {}) {
  const time = new Date().toISOString();
  console.log(`[${time}] [IMG-PROC] [${tag}] ${message}`, meta);
}
