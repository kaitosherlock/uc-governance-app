/**
 * providers.tsx — Application-level providers.
 *
 * For now, only sets up the router. TanStack Query belongs in P0-05
 * with the API client.
 */
import { RouterProvider } from "react-router";
import { router } from "./routes";

export function AppProviders() {
  return <RouterProvider router={router} />;
}
