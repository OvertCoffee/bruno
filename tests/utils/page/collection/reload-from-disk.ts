import { Page, test, expect } from '../../../../playwright';
import { buildSidebarLocators } from '../sidebar';
import { buildTitleBarLocators } from '../title-bar';

/**
 * Builds locators for "Reload from Disk" — the workspace menu entry and the confirm modal.
 * The collection menu entry is `sidebar.rowMenu(name, 'collection').item('reload-from-disk')`.
 */
export const buildReloadFromDiskLocators = (page: Page) => {
  const modal = () => page.getByTestId('reload-collections-modal');
  return {
    workspaceActionsTrigger: () => page.getByTestId('collection-header').getByTestId('workspace-actions-trigger'),
    workspaceMenuItem: () => page.getByTestId('reload-workspace-from-disk'),
    modal,
    draftsWarning: () => modal().getByTestId('reload-collections-drafts-warning'),
    confirmButton: () => page.getByTestId('reload-collections-modal-submit-btn')
  };
};

/**
 * Open "Reload from Disk" from a collection's sidebar menu. Leaves the confirm modal open.
 * @param page - The page object
 * @param collectionName - The collection to reload
 */
export const openReloadCollectionFromDisk = async (page: Page, collectionName: string) => {
  await test.step(`Open "Reload from Disk" for collection "${collectionName}"`, async () => {
    const sidebar = buildSidebarLocators(page);
    const menu = sidebar.rowMenu(collectionName, 'collection');

    // Re-hover on each poll: sidebar re-renders can shift the row out from under a one-shot hover()
    await expect(async () => {
      await sidebar.collectionRow(collectionName).hover();
      await expect(menu.trigger()).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await menu.trigger().click();
    await menu.item('reload-from-disk').click();
    await expect(buildReloadFromDiskLocators(page).modal()).toBeVisible();
  });
};

/**
 * Open "Reload from Disk" from the active workspace's actions menu. Leaves the confirm modal open.
 * Only non-default workspaces have this menu, and it shows on the workspace overview.
 * @param page - The page object
 */
export const openReloadWorkspaceFromDisk = async (page: Page) => {
  await test.step('Open "Reload from Disk" for the active workspace', async () => {
    const reload = buildReloadFromDiskLocators(page);

    await buildTitleBarLocators(page).homeButton().click();
    await page.locator('.request-tab').filter({ hasText: 'Overview' }).click();
    await reload.workspaceActionsTrigger().click();
    await reload.workspaceMenuItem().click();
    await expect(reload.modal()).toBeVisible();
  });
};

/**
 * Confirm the open "Reload from Disk" modal and wait for the reload to finish.
 * @param page - The page object
 */
export const confirmReloadFromDisk = async (page: Page) => {
  await test.step('Confirm reload from disk', async () => {
    const reload = buildReloadFromDiskLocators(page);

    await reload.confirmButton().click();
    await expect(reload.modal()).not.toBeVisible({ timeout: 10000 });
  });
};
