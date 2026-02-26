import { expect, test } from '@playwright/test';

test('smoke play: shop loop + pack opening + battle', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');

    // Wait for the sim snapshot to start flowing.
    await expect(page.getByText('Card Shop Simulator (MVP)')).toBeVisible();
    await expect(page.getByText(/Day\s+\d+\s+•\s+(DAY|NIGHT)/)).toBeVisible();

    // Make sure Phaser mounted a canvas.
    const canvas = page.locator('#game-container canvas');
    await expect(canvas).toHaveCount(1);

    // Reset state to a known baseline.
    await page.getByRole('button', { name: 'New Game' }).click();

    // Do a quick click-to-walk to ensure Phaser input is alive.
    await canvas.click({ position: { x: 350, y: 280 } });

    // Buy a single speed tier (should be affordable at game start).
    await page.getByRole('button', { name: /Buy Speed Tier/ }).click();

    const tabs = page.locator('.tabs');

    // Buy wholesale packs and stock a shelf slot.
    await tabs.getByRole('button', { name: 'Packs', exact: true }).click();
    const tier1SkuRow = page.locator('.panel .listRow', { hasText: 'Sealed Pack (Tier 1)' });
    await tier1SkuRow.getByRole('button', { name: 'Buy 1' }).click();
    await tier1SkuRow.getByRole('button', { name: 'Buy 1' }).click();

    await tabs.getByRole('button', { name: 'Manage', exact: true }).click();
    const slot1Row = page.locator('.panel .listRow', { hasText: 'Slot 1' }).first();
    await slot1Row.getByRole('button', { name: /Stock 1 \+1/ }).click();

    // Buy + open a player pack; verify collection UI appears.
    await tabs.getByRole('button', { name: 'Packs', exact: true }).click();
    const playerPackRow = page.locator('.panel .listRow', { hasText: 'Pack (T1 • common)' });
    await playerPackRow.getByRole('button', { name: 'Buy 1' }).click();
    await playerPackRow.getByRole('button', { name: 'Open 1' }).click();
    await expect(page.getByText(/Opened playerPack_t1_common/)).toBeVisible();
    await expect(page.getByText('Collection (scroll)')).toBeVisible();

    // Wait for a battle-ready customer, then resolve a battle.
    await tabs.getByRole('button', { name: 'Shop', exact: true }).click();
    await page.locator('.panel button:has-text("Battle"):not([disabled])').first().waitFor({
        timeout: 120_000,
    });
    await page.locator('.panel button:has-text("Battle"):not([disabled])').first().click();
    await expect(page.getByRole('button', { name: 'Start Battle' })).toBeEnabled();
    await page.getByRole('button', { name: 'Start Battle' }).click();
    await expect(page.getByText(/Battle vs/)).toBeVisible();

    // Surface any console/page errors from the run.
    expect(consoleErrors).toEqual([]);
});

