import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'screenshot-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const devices = {
  iphone65: {
    width: 428,
    height: 926,
    scale: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    name: 'iPhone-6.5-inch',
  },
  ipad13: {
    width: 1032,
    height: 1376,
    scale: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    name: 'iPad-13-inch',
  },
};

const baseUrl = process.env.APP_URL || config.baseUrl || 'http://localhost:5173';

function slugify(value) {
  return value.replace(/\s+/g, '-');
}

async function resetAppState(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('balance_sheet_storage_version', '9');
  });
}

async function handleSaveAlert(page, alertLocator, fileName) {
  await alertLocator.waitFor({ state: 'visible', timeout: 10000 });
  const input = alertLocator.locator('input.alert-input');
  await input.fill(fileName);
  await page.waitForTimeout(400);
  const saveBtn = alertLocator.locator('button.alert-button').filter({ hasText: 'Save' });
  await saveBtn.click();
  await alertLocator.waitFor({ state: 'hidden', timeout: 15000 });
}

async function openEditorFromDashboard(page) {
  const createBtn = page.locator('ion-button:has-text("Create")').first();
  await createBtn.click();
  await page.waitForURL('**/app/editor/**', { timeout: 20000 });
  await page.waitForSelector('.footer-type-btn', { state: 'visible', timeout: 20000 });
  await page.waitForTimeout(2000);
}

async function captureCellEditModal(page, screenshotsDir, isTablet) {
  await page.evaluate(() => {
    if (typeof window.setupMouseListener === 'function') {
      window.setupMouseListener();
    }
  });

  const targetCell = isTablet ? config.editCellTablet || 'D7' : config.editCellMobile || 'C7';
  const cellCoords = await page.evaluate((coord) => {
    const control = window.SocialCalc?.GetCurrentWorkBookControl?.();
    if (!control) return null;

    const editor = control.workbook.spreadsheet.editor;
    const activeSheet = editor.workingvalues.currentsheet;
    const sheetPrefix = `${activeSheet}!`;
    let cellToUse = coord;

    if (window.SocialCalc.EditableCells?.cells) {
      const fullCoord = sheetPrefix + coord;
      if (!window.SocialCalc.EditableCells.cells[fullCoord]) {
        const found = Object.keys(window.SocialCalc.EditableCells.cells).find((c) =>
          c.startsWith(sheetPrefix),
        );
        if (found) cellToUse = found.substring(sheetPrefix.length);
      }
    }

    const cr = window.SocialCalc.coordToCr(cellToUse);
    const cellInfo = window.SocialCalc.GetEditorCellElement(editor, cr.row, cr.col);
    if (!cellInfo?.element) return null;

    const rect = cellInfo.element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      resolvedCoord: cellToUse,
    };
  }, targetCell);

  if (cellCoords) {
    await page.mouse.click(cellCoords.x, cellCoords.y);
  } else {
    await page.evaluate(({ coord, val }) => {
      window.dispatchEvent(
        new CustomEvent('socialcalc:cell-edit-request', {
          detail: { coord, text: val, okfn: () => {} },
        }),
      );
    }, { coord: targetCell, val: config.editValue || '50000' });
  }

  await page.waitForSelector('.cell-edit-title', { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screenshotsDir, '7_edit_modal.png') });
  await page.click('.cell-edit-close-btn');
  await page.waitForSelector('.cell-edit-title', { state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(400);
}

async function run() {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed') || args.includes('-h');
  const targetDeviceKey = args.find((arg) => arg !== '--headed' && arg !== '-h' && devices[arg]);
  const devicesToCapture = targetDeviceKey
    ? { [targetDeviceKey]: devices[targetDeviceKey] }
    : { iphone65: devices.iphone65, ipad13: devices.ipad13 };

  console.log(`Balance Sheet screenshot capture`);
  console.log(`Target URL: ${baseUrl}`);

  for (const [key, dev] of Object.entries(devicesToCapture)) {
    console.log(`\n=== ${key} (${dev.name}) ===`);
    const isTablet = key.startsWith('ipad');
    const headedScale = headed ? (isTablet ? 1.5 : 1) : 1;
    const viewportWidth = Math.round(dev.width / headedScale);
    const viewportHeight = Math.round(dev.height / headedScale);

    const screenshotsDir = path.join(__dirname, 'screenshots', key);
    fs.rmSync(screenshotsDir, { recursive: true, force: true });
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const browser = await chromium.launch({
      headless: !headed,
      slowMo: headed ? 600 : 0,
    });

    const context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      deviceScaleFactor: headed ? 1 : dev.scale,
      userAgent: dev.userAgent,
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();

    try {
      await page.goto(baseUrl);
      await resetAppState(page);
      await page.goto(baseUrl);

      await page.waitForSelector('.step-title', { state: 'visible', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotsDir, '1_welcome.png') });

      const startBtn = page.locator(
        `ion-button:has-text("${config.onboardingButtonText || 'Start App'}")`,
      );
      await startBtn.click();
      await page.waitForURL('**/app/dashboard/home**', { timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '2_dashboard.png') });

      await openEditorFromDashboard(page);

      const tabButtons = page.locator('.footer-type-btn');
      let tabCount = await tabButtons.count();
      const maxTabs = isTablet ? config.maxTabsTablet : config.maxTabsMobile;
      tabCount = Math.min(tabCount, maxTabs || tabCount);

      for (let i = 0; i < tabCount; i++) {
        const tabButton = tabButtons.nth(i);
        const tabName = (await tabButton.innerText()).trim().replace(/[^a-zA-Z0-9-_]/g, '_');
        await tabButton.click();
        await page.waitForTimeout(1800);
        await page.screenshot({
          path: path.join(screenshotsDir, `3_sheet_tab_${i + 1}_${tabName}.png`),
        });
      }

      await captureCellEditModal(page, screenshotsDir, isTablet);

      await page.locator('.invoice-toolbar ion-buttons[slot="end"] > div').nth(1).click();
      await page.waitForSelector('ion-action-sheet button:has-text("Email")', {
        state: 'visible',
        timeout: 8000,
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotsDir, '8_share_menu.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      await page.locator('div[title="Save"]').click();
      const saveAlert = page
        .locator('ion-alert:visible')
        .filter({ hasText: config.saveFileDialogTitle || 'Save File' });
      await saveAlert.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(screenshotsDir, '9_save_dialog.png') });

      const fileName = config.saveFileName || 'My Balance Sheet';
      await handleSaveAlert(page, saveAlert, fileName);
      await page.waitForTimeout(1500);

      await page.locator('.invoice-toolbar ion-button').first().click();
      await page.waitForURL('**/app/dashboard/**', { timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotsDir, '10_dashboard_files.png') });

      console.log(`Captured 10 screenshots in ${screenshotsDir}`);
      await browser.close();
    } catch (error) {
      console.error(`Failed for ${key}:`, error);
      try {
        await page.screenshot({
          path: path.join(__dirname, `error_${key}.png`),
          fullPage: true,
        });
      } catch {
        /* ignore */
      }
      await browser.close();
      throw error;
    }
  }

  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
