// Browser-only: registers the service worker (production build; a no-op in dev) and reports a new
// version through the PWA store. The precache list includes the catalog manifest and the current
// catalog, so a catalog update also shows the "update available" prompt.
import { registerSW } from 'virtual:pwa-register';
import { setPwaState, setUpdateHandler } from './pwaStore';

const update = registerSW({
  immediate: true,
  onNeedRefresh() {
    setPwaState({ needRefresh: true });
  },
  onOfflineReady() {
    setPwaState({ offlineReady: true });
  },
});

setUpdateHandler(() => {
  void update(true);
});
