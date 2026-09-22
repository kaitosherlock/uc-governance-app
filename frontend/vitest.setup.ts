/**
 * vitest.setup.ts — test environment setup.
 *
 * `vitest.config.ts` deliberately leaves `globals` off, so every test file imports
 * `describe`, `it` and `expect` explicitly. A consequence that is easy to miss: with
 * no global `afterEach`, @testing-library/react cannot register its automatic cleanup,
 * so each `render()` appends to the same document and later queries find one element
 * per preceding test. Registering cleanup here keeps `globals: false` without that
 * side effect.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
