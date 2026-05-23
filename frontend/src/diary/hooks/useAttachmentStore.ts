import { openDB } from "idb";
import { useEffect, useState, useCallback } from "react";

const DB_NAME = "DiaryDB";
const STORE = "attachments";

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
        });
        store.createIndex("entryId", "entryId");
        store.createIndex("date", "date");
      }
    },
  });
}

export interface IDBAttachment {
  id: string;
  entryId: string;
  date: string;
  filename: string;
  mimeType: string;
  blob: Blob;
  caption: string;
  rotation: number;
  createdAt: string;
}

export async function saveAttachment(
  id: string,
  entryId: string,
  file: File | Blob,
  filename: string,
  mimeType: string,
  caption = "",
  rotation = 0
): Promise<string> {
  const db = await getDB();
  await db.put(STORE, {
    id,
    entryId,
    date: new Date().toISOString(),
    filename,
    mimeType,
    blob: file,
    caption,
    rotation,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getAttachments(entryId: string): Promise<IDBAttachment[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE, "entryId", entryId);
}

export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function updateAttachment(id: string, patch: Partial<IDBAttachment>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const item = await store.get(id);
  if (item) {
    Object.assign(item, patch);
    await store.put(item);
  }
  await tx.done;
}

export async function getAllAttachments(): Promise<IDBAttachment[]> {
  const db = await getDB();
  return db.getAll(STORE);
}

// React hook to manage attachments for a specific entry
export function useAttachments(entryId: string | null, onCountChange?: () => void) {
  const [attachments, setAttachments] = useState<(IDBAttachment & { dataUrl: string })[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!entryId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    try {
      const items = await getAttachments(entryId);
      // Mapped URLs
      const mapped = items.map((item) => {
        const url = URL.createObjectURL(item.blob);
        return {
          ...item,
          dataUrl: url,
        };
      });
      setAttachments(mapped);
    } catch (error) {
      console.error("Failed to load attachments from IndexedDB:", error);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    load();
    return () => {
      // Cleanup URLs to avoid memory leaks
      attachments.forEach((att) => {
        if (att.dataUrl.startsWith("blob:")) {
          URL.revokeObjectURL(att.dataUrl);
        }
      });
    };
  }, [load]);

  const add = async (file: File) => {
    if (!entryId) return;
    const id = crypto.randomUUID();
    const type = file.type;
    const rotation = Math.floor(Math.random() * 7) - 3;
    await saveAttachment(id, entryId, file, file.name, type, "", rotation);
    await load();
    if (onCountChange) onCountChange();
  };

  const remove = async (id: string) => {
    await deleteAttachment(id);
    await load();
    if (onCountChange) onCountChange();
  };

  const updateCaption = async (id: string, caption: string) => {
    await updateAttachment(id, { caption });
    // Update local state directly to be fast and responsive
    setAttachments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption } : item))
    );
  };

  return {
    attachments,
    loading,
    add,
    remove,
    updateCaption,
    reload: load,
  };
}
