// Node >= 22 exposes an experimental, non-functional `localStorage` global
// (stub without get/set methods unless --localstorage-file is passed) that
// shadows jsdom's implementation under vitest. Replace it with a working
// in-memory Storage for tests.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL cannot auto-register cleanup without vitest globals; do it explicitly.
afterEach(cleanup);

function makeStorage(): Storage {
  let store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store = new Map();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

vi.stubGlobal("localStorage", makeStorage());
vi.stubGlobal("sessionStorage", makeStorage());
