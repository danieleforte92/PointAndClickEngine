import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { deserializeSaveDocument, serializeSaveDocument } from "./document";
import { SAVE_SLOT_IDS, type SaveDocument, type SaveSlotId } from "./types";
import { assertSaveDocumentForSlot, type SaveStorage, type SaveStorageOptions } from "./storage";

export interface FileSaveStorageOptions extends SaveStorageOptions {
  readonly directory: string;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export class ElectronFileSaveStorage implements SaveStorage {
  private readonly directory: string;
  private readonly validationOptions: SaveStorageOptions;

  constructor(directoryOrOptions: string | FileSaveStorageOptions) {
    const options = typeof directoryOrOptions === "string" ? { directory: directoryOrOptions } : directoryOrOptions;
    this.directory = path.resolve(options.directory);
    this.validationOptions = {
      ...(options.expectedProjectFingerprint
        ? { expectedProjectFingerprint: options.expectedProjectFingerprint }
        : {})
    };
  }

  async list(): Promise<SaveSlotId[]> {
    const slots = await Promise.all(
      SAVE_SLOT_IDS.map(async (slot) => {
        try {
          await access(this.filePath(slot));
          return slot;
        } catch (error) {
          if (isMissingFile(error)) return null;
          throw error;
        }
      })
    );
    return slots.filter((slot): slot is SaveSlotId => slot !== null);
  }

  async read(slot: SaveSlotId): Promise<SaveDocument | null> {
    let serialized: string;
    try {
      serialized = await readFile(this.filePath(slot), "utf8");
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
    return deserializeSaveDocument(serialized, this.validationOptions);
  }

  async write(slot: SaveSlotId, document: SaveDocument): Promise<void> {
    assertSaveDocumentForSlot(slot, document, this.validationOptions);
    await mkdir(this.directory, { recursive: true });

    const destination = this.filePath(slot);
    const temporary = `${destination}.tmp-${randomUUID()}`;
    try {
      await writeFile(temporary, serializeSaveDocument(document), { encoding: "utf8", flag: "wx" });
      await rename(temporary, destination);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async delete(slot: SaveSlotId): Promise<void> {
    try {
      await unlink(this.filePath(slot));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  private filePath(slot: SaveSlotId): string {
    return path.join(this.directory, `${slot}.json`);
  }
}

export { ElectronFileSaveStorage as FileSaveStorage };
