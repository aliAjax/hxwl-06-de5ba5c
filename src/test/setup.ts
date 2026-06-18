import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  if (window.indexedDB && typeof window.indexedDB.deleteDatabase === "function") {
    const databases = (window.indexedDB as any).databases;
    if (typeof databases === "function") {
      databases().then((dbs: { name: string }[]) => {
        dbs.forEach((db) => {
          window.indexedDB.deleteDatabase(db.name);
        });
      });
    }
  }
});
