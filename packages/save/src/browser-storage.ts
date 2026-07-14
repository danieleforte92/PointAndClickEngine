import { deserializeSaveDocument, serializeSaveDocument } from "./document";
import { SAVE_SLOT_IDS, type SaveDocument, type SaveSlotId } from "./types";
import { assertSaveDocumentForSlot, type SaveStorage, type SaveStorageOptions } from "./storage";

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface BrowserSaveStorageOptions extends SaveStorageOptions {
  readonly keyPrefix?: string;
  readonly storage?: BrowserStorageLike;
  readonly getItem?: BrowserStorageLike["getItem"];
  readonly setItem?: BrowserStorageLike["setItem"];
  readonly removeItem?: BrowserStorageLike["removeItem"];
}

function defaultBrowserStorage(): BrowserStorageLike {
  if (typeof globalThis.localStorage === "undefined") {
    throw new Error("BrowserSaveStorage requires localStorage or an injected storage implementation.");
  }
  return globalThis.localStorage;
}

export class BrowserSaveStorage implements SaveStorage {
  private readonly storage: BrowserStorageLike;
  private readonly keyPrefix: string;
  private readonly validationOptions: SaveStorageOptions;

  constructor(options: BrowserSaveStorageOptions = {}) {
    this.storage = options.storage ??
      (options.getItem && options.setItem && options.removeItem
        ? {
            getItem: options.getItem,
            setItem: options.setItem,
            removeItem: options.removeItem
          }
        : defaultBrowserStorage());
    this.keyPrefix = options.keyPrefix ?? "pointclick:save:";
    this.validationOptions = {
      ...(options.expectedProjectFingerprint
        ? { expectedProjectFingerprint: options.expectedProjectFingerprint }
        : {})
    };
  }

  async list(): Promise<SaveSlotId[]> {
    return SAVE_SLOT_IDS.filter((slot) => this.storage.getItem(this.key(slot)) !== null);
  }

  async read(slot: SaveSlotId): Promise<SaveDocument | null> {
    const serialized = this.storage.getItem(this.key(slot));
    return serialized === null ? null : deserializeSaveDocument(serialized, this.validationOptions);
  }

  async write(slot: SaveSlotId, document: SaveDocument): Promise<void>;
  async write(document: SaveDocument): Promise<void>;
  async write(slotOrDocument: SaveSlotId | SaveDocument, maybeDocument?: SaveDocument): Promise<void> {
    const document = typeof slotOrDocument === "string" ? maybeDocument : slotOrDocument;
    if (!document) throw new Error("A save document is required.");
    const slot = typeof slotOrDocument === "string" ? slotOrDocument : document.slot;
    assertSaveDocumentForSlot(slot, document, this.validationOptions);
    this.storage.setItem(this.key(slot), serializeSaveDocument(document));
  }

  async delete(slot: SaveSlotId): Promise<void> {
    this.storage.removeItem(this.key(slot));
  }

  private key(slot: SaveSlotId): string {
    return `${this.keyPrefix}${slot}`;
  }
}
