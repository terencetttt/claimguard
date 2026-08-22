const DATABASE_NAME = "claimguard-evidence";
const DATABASE_VERSION = 1;
const STORE_NAME = "evidence-files";

export type StoredEvidenceBlob = {
  id: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  updatedAt: string;
};

export function evidenceBlobId(filename: string, size: number, mimeType: string) {
  return `file:${encodeURIComponent(filename)}:${size}:${encodeURIComponent(mimeType || "application/octet-stream")}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open evidence storage."));
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Evidence storage operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Evidence storage transaction failed.")); };
  });
}

export const evidenceBlobStorage = {
  async save(id: string, file: File) {
    const record: StoredEvidenceBlob = { id, blob: file, filename: file.name, mimeType: file.type || "application/octet-stream", updatedAt: new Date().toISOString() };
    await transact("readwrite", (store) => store.put(record));
  },
  async load(id: string) {
    return (await transact<StoredEvidenceBlob | undefined>("readonly", (store) => store.get(id))) ?? null;
  },
  async remove(id: string) {
    await transact("readwrite", (store) => store.delete(id));
  },
};
