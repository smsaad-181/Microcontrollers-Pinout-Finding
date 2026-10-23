import { useAppState } from '../state/AppState';

/** Whether the project survives a reload: saved in this browser, or kept in memory only. */
export function StorageStatus() {
  const { storage } = useAppState();
  if (storage === 'loading') return null;
  return (
    <p className="storage-status">
      {storage === 'indexeddb' ? (
        <>
          <span aria-hidden="true">✔</span> Project saved in this browser
        </>
      ) : (
        <>
          <span aria-hidden="true">!</span> Not saved: browser storage is unavailable. Save a
          project file to keep your work.
        </>
      )}
    </p>
  );
}
