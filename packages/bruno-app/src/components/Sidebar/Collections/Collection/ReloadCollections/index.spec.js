import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import ReloadCollections from './index';
import { reloadCollectionFromDisk } from 'providers/ReduxStore/slices/collections/actions';
import { getCollectionDrafts } from 'utils/collections/index';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn()
}));

jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  reloadCollectionFromDisk: jest.fn()
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

jest.mock('utils/collections/index', () => ({
  ...jest.requireActual('utils/collections/index'),
  findCollectionByUid: jest.fn((collections, uid) => collections.find((c) => c.uid === uid)),
  getCollectionDrafts: jest.fn()
}));

jest.mock('ui/Portal', () => ({ children }) => <div>{children}</div>);
jest.mock('./StyledWrapper', () => ({ children }) => <div>{children}</div>);
jest.mock('components/Modal', () => ({ children, title, confirmText, handleConfirm }) => (
  <div>
    <h1>{title}</h1>
    {children}
    <button onClick={handleConfirm}>{confirmText}</button>
  </div>
));

const NO_DRAFTS = { requestDrafts: [], transientDrafts: [], folderDrafts: [], collectionDrafts: [] };

const collections = [
  { uid: 'c1', name: 'Collection 1', pathname: '/path/to/c1' },
  { uid: 'c2', name: 'Collection 2', pathname: '/path/to/c2' }
];

describe('ReloadCollections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDispatch.mockReturnValue(jest.fn((action) => action));
    useSelector.mockImplementation((selector) => selector({ collections: { collections } }));
    getCollectionDrafts.mockReturnValue(NO_DRAFTS);
  });

  it('reloads every collection, then reports success and closes', async () => {
    const onClose = jest.fn();
    reloadCollectionFromDisk.mockImplementation(() => Promise.resolve());

    render(<ReloadCollections onClose={onClose} collectionUids={['c1', 'c2']} />);
    fireEvent.click(screen.getByText('Reload'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reloadCollectionFromDisk).toHaveBeenCalledWith('c1');
    expect(reloadCollectionFromDisk).toHaveBeenCalledWith('c2');
    expect(toast.success).toHaveBeenCalledWith('Collections reloaded from disk');
  });

  it('keeps the modal open and names the collections that failed to reload', async () => {
    const onClose = jest.fn();
    reloadCollectionFromDisk.mockImplementation((uid) =>
      uid === 'c2' ? Promise.reject(new Error('boom')) : Promise.resolve());

    render(<ReloadCollections onClose={onClose} collectionUids={['c1', 'c2']} />);
    fireEvent.click(screen.getByText('Reload'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to reload: Collection 2'));
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('warns that unsaved changes will be discarded', () => {
    getCollectionDrafts.mockReturnValue({ ...NO_DRAFTS, requestDrafts: [{}, {}] });

    render(<ReloadCollections onClose={jest.fn()} collectionUids={['c1']} />);

    expect(screen.getByTestId('reload-collections-drafts-warning')).toHaveTextContent('Unsaved changes in 2 items will be discarded.');
    expect(screen.getByText('Discard Changes and Reload')).toBeInTheDocument();
  });

  it('renders nothing when none of the collections exist', () => {
    const { container } = render(<ReloadCollections onClose={jest.fn()} collectionUids={['missing']} />);

    expect(container).toBeEmptyDOMElement();
  });
});
