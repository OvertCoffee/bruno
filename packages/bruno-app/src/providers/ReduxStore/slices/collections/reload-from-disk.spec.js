const { configureStore } = require('@reduxjs/toolkit');

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

const collectionsReducer = require('providers/ReduxStore/slices/collections').default;
const { resetCollectionTree } = require('providers/ReduxStore/slices/collections');
const tabsReducer = require('providers/ReduxStore/slices/tabs').default;
const { reloadCollectionFromDisk } = require('providers/ReduxStore/slices/collections/actions');

const COLLECTION_UID = 'col-1';
const NEW_TRANSIENT_DIR = '/tmp/bruno-transient-new';

const makeCollection = (overrides = {}) => ({
  uid: COLLECTION_UID,
  pathname: '/coll',
  mountStatus: 'mounted',
  brunoConfig: { version: '1', name: 'demo' },
  activeEnvironmentUid: 'env-1',
  root: { request: { headers: [] } },
  draft: { root: { request: { headers: [] } } },
  environmentsDraft: { environmentUid: 'env-1', variables: [] },
  environments: [{ uid: 'env-1', name: 'dev', variables: [] }],
  items: [{ uid: 'req-1', type: 'http-request', name: 'ping', draft: { request: {} } }],
  ...overrides
});

const makeStore = (collection) => configureStore({
  reducer: {
    app: (state = { preferences: { cache: { file: { enabled: false } } } }) => state,
    workspaces: (state = { activeWorkspaceUid: 'ws-1', workspaces: [{ uid: 'ws-1', pathname: '/ws' }] }) => state,
    collections: collectionsReducer,
    tabs: tabsReducer
  },
  preloadedState: {
    collections: { ...collectionsReducer(undefined, { type: 'init' }), collections: [collection] },
    tabs: {
      ...tabsReducer(undefined, { type: 'init' }),
      activeTabUid: 'req-1',
      tabs: [
        { uid: 'req-1', collectionUid: COLLECTION_UID, type: 'request' },
        { uid: 'transient-1', collectionUid: COLLECTION_UID, type: 'request', isTransient: true },
        { uid: 'transient-2', collectionUid: 'other-col', type: 'request', isTransient: true }
      ]
    }
  }
});

const invokedChannels = () => window.ipcRenderer.invoke.mock.calls.map(([channel]) => channel);

describe('resetCollectionTree', () => {
  it('drops disk-derived state and drafts but keeps the collection identity and selections', () => {
    const state = collectionsReducer(
      { collections: [makeCollection()] },
      resetCollectionTree({ collectionUid: COLLECTION_UID })
    );

    const collection = state.collections[0];
    expect(collection.items).toEqual([]);
    expect(collection.environments).toEqual([]);
    expect(collection.draft).toBeNull();
    expect(collection.environmentsDraft).toBeNull();
    expect(collection).not.toHaveProperty('root');
    expect(collection.pathname).toBe('/coll');
    expect(collection.brunoConfig).toEqual({ version: '1', name: 'demo' });
    expect(collection.activeEnvironmentUid).toBe('env-1');
  });
});

describe('reloadCollectionFromDisk', () => {
  beforeEach(() => {
    window.ipcRenderer = {
      invoke: jest.fn((channel) => {
        if (channel === 'renderer:mount-collection') {
          return Promise.resolve(NEW_TRANSIENT_DIR);
        }
        return Promise.resolve(null);
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('discards drafts and remounts the collection from disk', async () => {
    const store = makeStore(makeCollection());

    await store.dispatch(reloadCollectionFromDisk(COLLECTION_UID));

    const channels = invokedChannels();
    expect(channels.indexOf('renderer:unmount-collection')).toBeLessThan(channels.indexOf('renderer:mount-collection'));
    expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('renderer:unmount-collection', {
      collectionUid: COLLECTION_UID,
      collectionPathname: '/coll'
    });

    const { collections, tempDirectories } = store.getState().collections;
    expect(collections[0]).toMatchObject({
      mountStatus: 'mounted',
      items: [],
      draft: null,
      environmentsDraft: null,
      activeEnvironmentUid: 'env-1'
    });
    expect(tempDirectories[COLLECTION_UID]).toBe(NEW_TRANSIENT_DIR);
  });

  it('closes only this collection\'s transient tabs', async () => {
    const store = makeStore(makeCollection());

    await store.dispatch(reloadCollectionFromDisk(COLLECTION_UID));

    const tabUids = store.getState().tabs.tabs.map((t) => t.uid);
    expect(tabUids).toEqual(['req-1', 'transient-2']);
  });

  it('leaves an unmounted collection alone', async () => {
    const store = makeStore(makeCollection({ mountStatus: 'unmounted' }));

    await store.dispatch(reloadCollectionFromDisk(COLLECTION_UID));

    expect(window.ipcRenderer.invoke).not.toHaveBeenCalled();
    expect(store.getState().collections.collections[0].items).toHaveLength(1);
  });

  it('rejects for an unknown collection', async () => {
    const store = makeStore(makeCollection());

    await expect(store.dispatch(reloadCollectionFromDisk('missing'))).rejects.toThrow('Collection not found');
  });

  it('keeps drafts and tabs when unmounting fails', async () => {
    window.ipcRenderer.invoke.mockRejectedValueOnce(new Error('boom'));
    const store = makeStore(makeCollection());

    await expect(store.dispatch(reloadCollectionFromDisk(COLLECTION_UID))).rejects.toThrow('boom');

    const collection = store.getState().collections.collections[0];
    expect(collection.items[0].draft).not.toBeNull();
    expect(collection.draft).not.toBeNull();
    expect(store.getState().tabs.tabs).toHaveLength(3);
  });
});
