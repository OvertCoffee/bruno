import React from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { IconAlertTriangle } from '@tabler/icons';
import Modal from 'components/Modal';
import Portal from 'ui/Portal';
import { reloadCollectionFromDisk } from 'providers/ReduxStore/slices/collections/actions';
import { findCollectionByUid, getCollectionDrafts } from 'utils/collections/index';
import { pluralizeWord } from 'utils/common';
import StyledWrapper from './StyledWrapper';

const ReloadCollections = ({ onClose, collectionUids }) => {
  const dispatch = useDispatch();
  const allCollections = useSelector((state) => state.collections.collections || []);

  const collections = collectionUids.map((uid) => findCollectionByUid(allCollections, uid)).filter(Boolean);
  const { requestDrafts, transientDrafts, folderDrafts, collectionDrafts } = getCollectionDrafts(collections);
  const draftsCount = requestDrafts.length + transientDrafts.length + folderDrafts.length + collectionDrafts.length;

  const onConfirm = async () => {
    const results = await Promise.allSettled(collections.map((c) => dispatch(reloadCollectionFromDisk(c.uid))));

    const failedCollections = collections.filter((c, index) => results[index].status === 'rejected');
    if (failedCollections.length) {
      toast.error(`Failed to reload: ${failedCollections.map((c) => c.name).join(', ')}`);
      return;
    }

    toast.success(`${pluralizeWord('Collection', collections.length)} reloaded from disk`);
    onClose();
  };

  if (!collections.length) {
    return null;
  }

  return (
    <Portal>
      <StyledWrapper>
        <Modal
          size="sm"
          title={`Reload ${pluralizeWord('Collection', collections.length)} from Disk`}
          confirmText={draftsCount > 0 ? 'Discard Changes and Reload' : 'Reload'}
          confirmButtonColor={draftsCount > 0 ? 'danger' : 'primary'}
          dataTestId="reload-collections-modal"
          handleConfirm={onConfirm}
          handleCancel={onClose}
        >
          <p className="mb-4">
            {collections.length > 1 ? 'These collections' : 'This collection'} will be re-read from the files on disk:
          </p>
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {collections.map((c) => (
              <li key={c.uid}>
                <div className="font-medium truncate">{c.name}</div>
                <div className="collection-path text-xs">{c.pathname}</div>
              </li>
            ))}
          </ul>
          {draftsCount > 0 && (
            <div className="flex items-start gap-2 mt-4" data-testid="reload-collections-drafts-warning">
              <IconAlertTriangle size={18} strokeWidth={1.5} className="warning-icon shrink-0" />
              <span>
                Unsaved changes in <span className="font-medium">{draftsCount}</span> {pluralizeWord('item', draftsCount)} will be
                discarded.
              </span>
            </div>
          )}
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default ReloadCollections;
