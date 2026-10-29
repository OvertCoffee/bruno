jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: { fromWebContents: jest.fn() }
}));
jest.mock('../services/mount', () => {
  const manager = {
    mount: jest.fn(),
    unmount: jest.fn(async () => {}),
    shutdown: jest.fn(),
    clearCollectionIndex: jest.fn()
  };
  return { MountManager: jest.fn(() => manager), manager };
});
jest.mock('../app/collection-watcher', () => ({
  removeWatcher: jest.fn()
}));

const { ipcMain } = require('electron');
const { manager } = require('../services/mount');
const collectionWatcher = require('../app/collection-watcher');
const { registerMountIpc, unmountCollection } = require('./mount');

describe('unmountCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detaches the watcher, unmounts and clears the file-cache index', async () => {
    await unmountCollection({ collectionUid: 'c1', collectionPathname: '/tmp/collection' });

    expect(collectionWatcher.removeWatcher).toHaveBeenCalledWith('/tmp/collection', null, 'c1');
    expect(manager.unmount).toHaveBeenCalledWith('c1');
    expect(manager.clearCollectionIndex).toHaveBeenCalledWith('/tmp/collection');
  });

  it('rejects when the collection is not identified', async () => {
    await expect(unmountCollection({ collectionUid: 'c1' })).rejects.toThrow('collectionPathname');
    await expect(unmountCollection()).rejects.toThrow('collectionUid');
    expect(collectionWatcher.removeWatcher).not.toHaveBeenCalled();
    expect(manager.unmount).not.toHaveBeenCalled();
  });

  it('is registered on renderer:unmount-collection', async () => {
    registerMountIpc();

    const [, handler] = ipcMain.handle.mock.calls.find(([channel]) => channel === 'renderer:unmount-collection');
    await handler({}, { collectionUid: 'c1', collectionPathname: '/tmp/collection' });

    expect(manager.unmount).toHaveBeenCalledWith('c1');
  });
});
