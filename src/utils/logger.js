const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m",    // Cyan
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m",   // Red
  debug: "\x1b[35m",   // Magenta
  timestamp: "\x1b[90m" // Gray
};

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  const metaStr = meta && Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : "";
  return `${colors.timestamp}[${timestamp}]${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset} ${message}${metaStr}`;
};

export const logger = {
  info: (message, meta) => console.log(formatMessage("info", message, meta)),
  warn: (message, meta) => console.warn(formatMessage("warn", message, meta)),
  error: (message, error) => {
    const errorDetails = error instanceof Error ? error.stack : error;
    console.error(formatMessage("error", message, errorDetails ? { details: errorDetails } : undefined));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(formatMessage("debug", message, meta));
    }
  }
};
