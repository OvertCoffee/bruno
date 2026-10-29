import * as fs from 'fs';
import * as path from 'path';
import { test, expect, closeElectronApp, waitForReadyPage } from '../../../playwright';
import {
  buildCommonLocators,
  closeAllCollections,
  confirmReloadFromDisk,
  createCollection,
  createRequest,
  createWorkspace,
  fillRequestUrl,
  openReloadCollectionFromDisk,
  openReloadWorkspaceFromDisk
} from '../../utils/page';

const findRequestFile = (dir: string, requestName: string): string => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findRequestFile(entryPath, requestName);
      if (found) return found;
    } else if (entry.name === `${requestName}.yml` || entry.name === `${requestName}.bru`) {
      return entryPath;
    }
  }
  return '';
};

const replaceInFile = (filePath: string, from: string, to: string) => {
  fs.writeFileSync(filePath, fs.readFileSync(filePath, 'utf8').replace(from, to));
};

test.describe('Reload from Disk', () => {
  test.afterAll(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('collection menu discards unsaved changes and shows the request as saved on disk', async ({ page, createTmpDir }) => {
    const locators = buildCommonLocators(page);
    const collectionDir = await createTmpDir('reload-collection');

    await test.step('Create a request and leave an unsaved URL edit', async () => {
      await createCollection(page, 'reload-collection', collectionDir);
      await createRequest(page, 'ping', 'reload-collection', { url: 'https://example.com/original' });
      await fillRequestUrl(page, 'https://example.com/unsaved-edit');
      await expect(locators.tabs.draftIndicator()).toBeVisible();
    });

    await test.step('Change the request file on disk', async () => {
      replaceInFile(findRequestFile(collectionDir, 'ping'), 'https://example.com/original', 'https://example.com/from-disk');
    });

    await test.step('Reload the collection, discarding the draft', async () => {
      await openReloadCollectionFromDisk(page, 'reload-collection');
      await expect(locators.reloadFromDisk.draftsWarning()).toBeVisible();
      await confirmReloadFromDisk(page);
    });

    await test.step('The open tab shows the file contents with no draft', async () => {
      await expect(locators.request.urlLine()).toContainText('https://example.com/from-disk');
      await expect(locators.tabs.draftIndicator()).not.toBeVisible();
    });
  });

  test('workspace menu reloads every open collection in the workspace', async ({ launchElectronApp, createTmpDir }) => {
    const userDataPath = await createTmpDir('reload-workspace-userdata');
    const collectionDir = await createTmpDir('reload-workspace-collection');
    const app = await launchElectronApp({ userDataPath });
    const page = await waitForReadyPage(app);
    const locators = buildCommonLocators(page);

    await test.step('Create a workspace with a collection holding an unsaved edit', async () => {
      await createWorkspace(page, 'Reload Workspace');
      await createCollection(page, 'workspace-collection', collectionDir);
      await createRequest(page, 'ping', 'workspace-collection', { url: 'https://example.com/original' });
      await fillRequestUrl(page, 'https://example.com/unsaved-edit');
      await expect(locators.tabs.draftIndicator()).toBeVisible();
    });

    await test.step('Reload the workspace, discarding the draft', async () => {
      await openReloadWorkspaceFromDisk(page);
      await expect(locators.reloadFromDisk.modal()).toContainText('workspace-collection');
      await expect(locators.reloadFromDisk.draftsWarning()).toBeVisible();
      await confirmReloadFromDisk(page);
    });

    await test.step('The request no longer has a draft', async () => {
      await locators.sidebar.request('ping').click();
      await expect(locators.request.urlLine()).toContainText('https://example.com/original');
      await expect(locators.tabs.draftIndicator()).not.toBeVisible();
    });

    await closeElectronApp(app);
  });
});
