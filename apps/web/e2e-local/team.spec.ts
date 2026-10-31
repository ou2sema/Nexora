import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'local-e2e-password';
const CAROL = 'carol@example.com';

async function signIn(page: Page, email = 'alice@example.com'): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

async function invite(page: Page, email: string, role: string): Promise<void> {
  await page.getByRole('button', { name: 'Invite member' }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite a team member' });
  await expect(dialog).toBeVisible();
  await dialog.locator('#invite-email').fill(email);
  await dialog.locator('#invite-role').selectOption(role);
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
}

test.describe('team access', () => {
  test('owner invites a colleague who accepts, then changes role and removes them', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();

    const members = page.getByRole('region', { name: 'Members' });
    const invitations = page.getByRole('region', { name: 'Invitations' });
    const carolMember = members.getByRole('row', { name: /carol@example\.com/ });

    await expect(members.getByRole('row', { name: /dave@example\.com/ })).toContainText('Viewer');
    await expect(carolMember).toHaveCount(0);

    await invite(page, CAROL, 'viewer');
    await expect(page.getByRole('dialog', { name: 'Invite a team member' })).toBeHidden();

    const pendingInvite = invitations
      .getByRole('row', { name: /carol@example\.com/ })
      .filter({ hasText: 'Pending' });
    await expect(pendingInvite).toHaveCount(1);
    await expect(pendingInvite).toContainText('Viewer');

    await invite(page, CAROL, 'viewer');
    const duplicateDialog = page.getByRole('dialog', { name: 'Invite a team member' });
    await expect(duplicateDialog.getByRole('alert')).toContainText(
      'An invitation is already pending for this email.',
    );
    await duplicateDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(duplicateDialog).toBeHidden();

    await signOut(page);
    await signIn(page, CAROL);

    const banner = page.getByRole('region', { name: 'Pending invitations' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Org A');
    await expect(banner).toContainText('Viewer');
    await banner.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(banner).toBeHidden();

    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
    const carolAsMember = members.getByRole('row', { name: /carol@example\.com/ });
    await expect(carolAsMember).toContainText('You');
    await expect(carolAsMember).toContainText('Viewer');

    await signOut(page);
    await signIn(page);
    await page.goto('/team');

    const roleSelect = members
      .getByRole('row', { name: /carol@example\.com/ })
      .getByLabel(`Role for ${CAROL}`);
    await expect(roleSelect).toHaveValue('viewer');

    await roleSelect.selectOption('manager');
    await expect(roleSelect).toHaveValue('manager');

    await members
      .getByRole('row', { name: /carol@example\.com/ })
      .getByRole('button', { name: 'Remove' })
      .click();

    const removeDialog = page.getByRole('dialog', { name: 'Remove team member' });
    await expect(removeDialog).toContainText(CAROL);
    await removeDialog.getByRole('button', { name: 'Remove member' }).click();
    await expect(removeDialog).toBeHidden();
    await expect(members.getByRole('row', { name: /carol@example\.com/ })).toHaveCount(0);
  });

  test('viewer sees the team read-only', async ({ page }) => {
    await signIn(page, 'dave@example.com');
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();

    const members = page.getByRole('region', { name: 'Members' });
    await expect(page.getByText('Your viewer role can view the team.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite member' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Invitations' })).toHaveCount(0);
    await expect(members.getByRole('combobox')).toHaveCount(0);
    await expect(members.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    await expect(members.getByRole('row', { name: /dave@example\.com/ })).toContainText('Viewer');
  });
});
