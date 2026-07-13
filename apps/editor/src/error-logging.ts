import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

const maxLogBytes = 5 * 1024 * 1024;
const logFileName = "pointclick.log";

function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/((?:api[-_ ]?key|token|secret|password|prompt)\s*[:=]\s*)(["']?)[^\s"']+\2/gi, "$1[REDACTED]");
}

export interface LocalLogRecord {
  at: string;
  event: string;
  details?: Record<string, unknown>;
  level: "error" | "warn" | "info";
}

function safeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined
    };
  }
  if (typeof value === "string") {
    const redacted = redactText(value);
    return redacted.length > 2000 ? `${redacted.slice(0, 2000)}...` : redacted;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(safeValue);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/key|token|secret|password|prompt/i.test(key)) continue;
      result[key] = safeValue(entry);
    }
    return result;
  }
  return value;
}

export function createLogRecord(
  event: string,
  level: LocalLogRecord["level"],
  details?: Record<string, unknown>
): LocalLogRecord {
  return {
    at: new Date().toISOString(),
    event,
    level,
    ...(details ? { details: safeValue(details) as Record<string, unknown> } : {})
  };
}

export class LocalErrorLogger {
  private writeQueue = Promise.resolve();

  constructor(private readonly directory: string, private readonly maxBytes = maxLogBytes) {}

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  log(record: LocalLogRecord): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await this.initialize();
        await this.rotateIfNeeded();
        await appendFile(this.filePath(), `${JSON.stringify(record)}\n`, "utf8");
      })
      .catch(() => undefined);
    return this.writeQueue;
  }

  logError(event: string, error: unknown, details?: Record<string, unknown>): Promise<void> {
    return this.log(
      createLogRecord(event, "error", {
        ...(details ?? {}),
        error: safeValue(error)
      })
    );
  }

  private filePath(): string {
    return path.join(this.directory, logFileName);
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const current = await stat(this.filePath());
      if (current.size < this.maxBytes) return;
    } catch {
      return;
    }

    const oldest = path.join(this.directory, `${logFileName}.2`);
    const previous = path.join(this.directory, `${logFileName}.1`);
    const current = this.filePath();
    await rename(previous, oldest).catch(() => undefined);
    await rename(current, previous).catch(() => undefined);
  }
}

export function installProcessErrorLogging(logger: LocalErrorLogger): void {
  process.on("uncaughtException", (error) => {
    void logger.logError("uncaught-exception", error);
  });
  process.on("unhandledRejection", (reason) => {
    void logger.logError("unhandled-rejection", reason);
  });
}
