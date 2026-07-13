import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BrowserSaveStorage,
  type BrowserStorageLike,
  computeProjectFingerprint,
  computeSaveChecksum,
  createSaveDocument,
  createStableCheckpoint,
  deserializeSaveDocument,
  inspectSaveDocument,
  SAVE_SLOT_IDS,
  SaveCorruptionError,
  serializeSaveDocument,
  sha256Hex
} from "./index";
import { FileSaveStorage } from "./electron-file-storage";

const projectFingerprint = computeProjectFingerprint({
  manifest: { id: "sample", initialSceneId: "dock" },
  scenes: ["dock", "tavern"]
});

const checkpoint = createStableCheckpoint(
  {
    sceneId: "dock",
    player: { x: 100, y: 200 },
    inventory: ["rusty-hook"],
    flags: { "drawer.open": true }
  },
  { flowId: "opening", nodeId: "line-2" },
  [{ type: "game/started" }, { type: "pickup/collected", itemId: "rusty-hook" }]
);

function documentFor(slot: (typeof SAVE_SLOT_IDS)[number] = "manual-1") {
  return createSaveDocument({
    slot,
    projectFingerprint,
    locale: "en",
    checkpoint,
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:05:00.000Z"
  });
}

class MemoryStorage implements BrowserStorageLike {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("save documents", () => {
  it("uses standard SHA-256 for checksums and fingerprints", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("round-trips a stable checkpoint without movement progress", () => {
    const document = documentFor();
    const restored = deserializeSaveDocument(serializeSaveDocument(document));

    expect(restored).toEqual(document);
    expect(restored.checkpoint).toEqual(checkpoint);
    expect(restored.checkpoint).not.toHaveProperty("pathProgress");
    expect(inspectSaveDocument(restored)).toEqual({ valid: true, errors: [] });
  });

  it("supports all manual slots and autosave through browser storage", async () => {
    const storage = new BrowserSaveStorage({ storage: new MemoryStorage() });

    for (const slot of SAVE_SLOT_IDS) {
      await storage.write(slot, documentFor(slot));
    }

    expect(await storage.list()).toEqual([...SAVE_SLOT_IDS]);
    expect(await storage.read("manual-2")).toEqual(documentFor("manual-2"));
    await storage.delete("autosave");
    expect(await storage.list()).toEqual(["manual-1", "manual-2", "manual-3"]);
  });

  it("detects checksum changes", () => {
    const document = documentFor();
    const tampered = {
      ...document,
      checkpoint: {
        ...document.checkpoint,
        worldState: { ...document.checkpoint.worldState, player: { x: 999, y: 999 } }
      }
    };

    const result = inspectSaveDocument(tampered);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "checksum-mismatch", path: "checksum" })])
    );
    expect(computeSaveChecksum(document)).toBe(document.checksum);
  });

  it("creates stable fingerprints independent of object key order", () => {
    const first = computeProjectFingerprint({ b: 2, nested: { z: false, a: 1 }, a: 1 });
    const second = computeProjectFingerprint({ a: 1, nested: { a: 1, z: false }, b: 2 });
    const changed = computeProjectFingerprint({ a: 1, b: 3, nested: { a: 1, z: false } });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("reports a project fingerprint mismatch as invalid", () => {
    const result = inspectSaveDocument(documentFor(), {
      expectedProjectFingerprint: computeProjectFingerprint({ project: "other" })
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "fingerprint-mismatch" })])
    );
  });

  it("raises corruption errors for malformed JSON and damaged files", async () => {
    expect(() => deserializeSaveDocument("{broken json")).toThrow(SaveCorruptionError);

    const directory = await mkdtemp(path.join(tmpdir(), "pointclick-save-corruption-"));
    const storage = new FileSaveStorage(directory);
    await writeFile(path.join(directory, "manual-1.json"), "{\"schemaVersion\":1}", "utf8");

    await expect(storage.read("manual-1")).rejects.toThrow(SaveCorruptionError);
    await expect(readFile(path.join(directory, "manual-1.json"), "utf8")).resolves.toContain("schemaVersion");
  });

  it("round-trips a document through the Electron/file adapter", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "pointclick-save-file-"));
    const storage = new FileSaveStorage(directory);
    const document = documentFor("manual-3");

    await storage.write("manual-3", document);

    expect(await storage.list()).toEqual(["manual-3"]);
    expect(await storage.read("manual-3")).toEqual(document);
  });
});
