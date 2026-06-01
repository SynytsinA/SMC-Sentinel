export function logInfo(message: string): void {
  const timestamp = new Date().toLocaleTimeString('uk-UA', { hour12: false });
  console.log(`[INFO] [${timestamp}] ${message}`);
}

export function logError(message: string, error?: any): void {
  const timestamp = new Date().toLocaleTimeString('uk-UA', { hour12: false });
  console.error(`[ERROR] [${timestamp}] ${message}`, error ? error : '');
}

export function logWarn(message: string): void {
  const timestamp = new Date().toLocaleTimeString('uk-UA', { hour12: false });
  console.warn(`[WARN] [${timestamp}] ${message}`);
}
