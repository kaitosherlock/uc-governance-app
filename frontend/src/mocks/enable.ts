/**
 * enable.ts — Conditionally start MSW in development mode.
 *
 * It is impossible for the worker to start in a production build.
 */
export async function enableMocking(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MSW === "false") {
    return;
  }

  const { worker } = await import("./browser");
  await worker.start({
    onUnhandledRequest: "bypass",
  });
}
