export function startupTrace(event: string, detail?: string) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  console.log(detail ? `[startup] ${event} ${detail}` : `[startup] ${event}`);
}
