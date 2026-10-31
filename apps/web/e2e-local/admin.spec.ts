import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'local-e2e-password';

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test.describe('platform administration', () => {
  test('admin creates an organization, picks the member organization, and manages its team', async ({
    page,
  }) => {
    const project = test.info().project.name;
    const organizationName = `E2E Org ${project}`;
    const invitedManager = `admin-manager-${project}@example.com`;

    await signIn(page, 'pat@example.com');
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'New organization' }).first().click();
    const createDialog = page.getByRole('dialog', { name: 'Create organization' });
    await expect(createDialog).toBeVisible();
    await createDialog.locator('#organization-name').fill(organizationName);
    await createDialog.locator('#organization-first-member-email').fill('gina@example.com');
    await createDialog.locator('#organization-first-member-role').selectOption('manager');
    await createDialog.getByRole('button', { name: 'Create organization' }).click();
    await expect(createDialog).toBeHidden();

    const organizationRow = page.locator('tbody tr').filter({ hasText: organizationName });
    await expect(organizationRow).toBeVisible();
    await expect(organizationRow.getByRole('cell').nth(2)).toHaveText('1');

    await page.getByRole('button', { name: 'Invite member' }).click();
    const inviteDialog = page.getByRole('dialog', { name: 'Invite a member' });
    await expect(inviteDialog).toBeVisible();

    const organizationSelect = inviteDialog.locator('#admin-invite-organization');
    const organizationOption = organizationSelect
      .locator('option')
      .filter({ hasText: organizationName });
    const organizationId = await organizationOption.getAttribute('value');
    expect(organizationId).toBeTruthy();
    await organizationSelect.selectOption(organizationId as string);
    await inviteDialog.locator('#admin-invite-email').fill(invitedManager);
    await inviteDialog.locator('#admin-invite-role').selectOption('manager');
    await inviteDialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(inviteDialog).toBeHidden();

    await expect(organizationRow.getByRole('cell').nth(2)).toHaveText('2');

    await organizationRow.getByRole('link', { name: 'Manage team' }).click();
    await expect(page).toHaveURL(/\/admin\/organizations\/[0-9a-f-]+\/team/);
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();

    const members = page.getByRole('region', { name: 'Members' });
    const invitations = page.getByRole('region', { name: 'Invitations' });
    await expect(members).toContainText('pat@example.com');
    await expect(invitations).toContainText('gina@example.com');
    await expect(invitations).toContainText(invitedManager);
    await expect(members.getByRole('combobox').first()).toBeVisible();

    await page.locator('#main-content').getByRole('link', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('manager invites viewers only and cannot manage members', async ({ page }) => {
    const project = test.info().project.name;
    const viewerEmail = `manager-viewer-${project}@example.com`;

    await signIn(page, 'gina@example.com');
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();

    const members = page.getByRole('region', { name: 'Members' });
    const invitations = page.getByRole('region', { name: 'Invitations' });

    await expect(
      page.getByText(
        'Managers can invite viewers. Owners and admins manage roles and invitations.',
      ),
    ).toBeVisible();
    await expect(members.getByRole('combobox')).toHaveCount(0);
    await expect(members.getByRole('button', { name: 'Remove' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Invite viewer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite a team member' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Managers can invite viewers only.')).toBeVisible();
    await expect(dialog.locator('#invite-role')).toHaveCount(0);

    await dialog.locator('#invite-email').fill(viewerEmail);
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog).toBeHidden();

    await expect(invitations.getByRole('row', { name: new RegExp(viewerEmail) })).toHaveCount(1);
    await expect(invitations.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
  });
});
