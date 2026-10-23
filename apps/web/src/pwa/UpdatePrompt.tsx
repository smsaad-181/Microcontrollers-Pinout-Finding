import { useState } from 'react';
import { setPwaState, updateNow, usePwaState } from './pwaStore';

/** "Update available" and "ready offline" notices from the service worker. */
export function UpdatePrompt() {
  const { needRefresh, offlineReady } = usePwaState();
  const [dismissedOffline, setDismissedOffline] = useState(false);
  if (needRefresh) {
    return (
      <div className="update-prompt no-print" role="status">
        <p>
          A new version of Pinout Finder or its catalog is available. Your project is saved and
          stays open.
        </p>
        <button type="button" onClick={updateNow}>
          Update now
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            setPwaState({ needRefresh: false });
          }}
        >
          Later
        </button>
      </div>
    );
  }
  if (offlineReady && !dismissedOffline) {
    return (
      <div className="update-prompt no-print" role="status">
        <p>Pinout Finder is ready to work offline.</p>
        <button
          type="button"
          onClick={() => {
            setDismissedOffline(true);
          }}
        >
          OK
        </button>
      </div>
    );
  }
  return null;
}
