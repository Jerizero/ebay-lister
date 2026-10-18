import fs from 'fs';
import path from 'path';

export type LifecycleTag = 'ACTION_START' | 'ACTION_FINISH' | 'ERROR' | 'DEBOUNCE';

export interface LogEntry {
  timestamp: string;
  tag: LifecycleTag;
  scope: string;
  action: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ebay-lister.log');

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch {
    // Ignore in read-only or browser environments
  }
}

export function logEvent(
  tag: LifecycleTag,
  scope: string,
  action: string,
  meta?: Record<string, unknown>,
  durationMs?: number
): void {
  const timestamp = new Date().toISOString();
  const durationPart = durationMs !== undefined ? ` (${durationMs}ms)` : '';
  const metaPart = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `${timestamp} [${tag}] [${scope}] ${action}${durationPart}${metaPart}\n`;



  if (tag === 'ERROR') {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line, { encoding: 'utf8' });
  } catch {
    // Safe fallback if running in environments without local fs write access
  }
}

export async function withActionLog<T>(
  scope: string,
  action: string,
  meta: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  logEvent('ACTION_START', scope, action, meta);
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logEvent('ACTION_FINISH', scope, action, { ...meta, status: 'ok' }, durationMs);
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logEvent('ERROR', scope, action, { ...meta, error: errorMessage }, durationMs);
    throw err;
  }
}
