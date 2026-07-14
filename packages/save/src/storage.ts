import {
  assertValidSaveDocument,
  deserializeSaveDocument,
  serializeSaveDocument
} from "./document";
import {
  SAVE_SLOT_IDS,
  type SaveDocument,
  type SaveSlotId,
  type SaveValidationOptions
} from "./types";

export interface SaveStorage<TDocument extends SaveDocument = SaveDocument> {
  list(): Promise<SaveSlotId[]>;
  read(slot: SaveSlotId): Promise<TDocument | null>;
  write(slot: SaveSlotId, document: TDocument): Promise<void>;
  delete(slot: SaveSlotId): Promise<void>;
}

export interface SaveStorageOptions extends SaveValidationOptions {}

export function assertSaveDocumentForSlot(
  slot: SaveSlotId,
  document: SaveDocument,
  options: SaveStorageOptions = {}
): void {
  if (document.slot !== slot) {
    throw new Error(`Save document belongs to slot "${document.slot}", not "${slot}".`);
  }
  assertValidSaveDocument(document, options);
}

export class MemorySaveStorage implements SaveStorage {
  private readonly documents = new Map<SaveSlotId, SaveDocument>();

  async list(): Promise<SaveSlotId[]> {
    return SAVE_SLOT_IDS.filter((slot) => this.documents.has(slot));
  }

  async read(slot: SaveSlotId): Promise<SaveDocument | null> {
    const document = this.documents.get(slot);
    return document ? deserializeSaveDocument(serializeSaveDocument(document)) : null;
  }

  async write(slot: SaveSlotId, document: SaveDocument): Promise<void>;
  async write(document: SaveDocument): Promise<void>;
  async write(slotOrDocument: SaveSlotId | SaveDocument, maybeDocument?: SaveDocument): Promise<void> {
    const document = typeof slotOrDocument === "string" ? maybeDocument : slotOrDocument;
    if (!document) throw new Error("A save document is required.");
    const slot = typeof slotOrDocument === "string" ? slotOrDocument : document.slot;
    assertSaveDocumentForSlot(slot, document);
    this.documents.set(slot, deserializeSaveDocument(serializeSaveDocument(document)));
  }

  async delete(slot: SaveSlotId): Promise<void> {
    this.documents.delete(slot);
  }
}
