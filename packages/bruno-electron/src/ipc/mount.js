const { ipcMain, BrowserWindow } = require('electron');
const { MountManager } = require('../services/mount');
const { checkpoint, createSpan } = require('../utils/benchmark');

const manager = new MountManager();

// Detaches the watcher and drops the file-cache index so the next mount re-reads every file
// from disk. Request uids are deliberately kept: they are derived from pathnames, so open tabs
// still resolve to the same items once the collection is mounted again.
const unmountCollection = async ({ collectionUid, collectionPathname } = {}) => {
  if (!collectionUid || !collectionPathname) {
    throw new Error('collectionUid and collectionPathname are required');
  }

  const collectionWatcher = require('../app/collection-watcher');
  collectionWatcher.removeWatcher(collectionPathname, null, collectionUid);
  await manager.unmount(collectionUid);
  manager.clearCollectionIndex(collectionPathname);
};

const registerMountIpc = () => {
  ipcMain.handle(
    'renderer:mount-collection-v2',
    async (event, { collectionUid, collectionPathname, brunoConfig }) => {
      const span = createSpan('mount-collection-v2', { collectionPathname });
      checkpoint('mount-collection-start', { collectionPathname });

      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        const send = (channel, payload) => {
          if (!win || win.isDestroyed?.()) return;
          win.webContents.send(channel, payload);
        };
        const emit = {
          tree: (tree) => send('main:collection-tree-loaded', { collectionUid, tree }),
          loading: (isLoading) => send('main:collection-loading-state-updated-v2', { collectionUid, isLoading }),
          config: (brunoConfig) => send('main:bruno-config-update-v2', { collectionUid, brunoConfig })
        };
        const result = await manager.mount({ win, collectionPath: collectionPathname, collectionUid, brunoConfig, emit });

        checkpoint('mount-collection-end', { collectionPathname });
        return result;
      } finally {
        span.stop();
      }
    }
  );

  ipcMain.handle('renderer:unmount-collection', (event, args) => unmountCollection(args));
};

const unmount = (collectionUid) => manager.unmount(collectionUid);
const shutdown = (opts) => manager.shutdown(opts);
const clearCollectionIndex = (collectionPath) => manager.clearCollectionIndex(collectionPath);

module.exports = { registerMountIpc, unmountCollection, unmount, shutdown, clearCollectionIndex };
