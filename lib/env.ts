export function getEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function optEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}
