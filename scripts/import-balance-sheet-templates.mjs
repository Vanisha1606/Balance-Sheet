/**
 * Import Balance Sheet workbook templates from platforms/ios/www/templates/tab-home.html
 * into public/templates/data and meta (House-Maintenance structure).
 *
 * Post-processes templates:
 * - Year columns → 2026 / 2025
 * - Date serials → June 2026 baseline
 * - Editable cell constraints → text vs numeric
 *
 * Usage: node scripts/import-balance-sheet-templates.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const tabHome = path.join(root, '../platforms/ios/www/templates/tab-home.html');

const CURRENT_YEAR = 2026;
const PRIOR_YEAR = 2025;
/** Prefilled date shown as plain text in templates */
const DATE_TEXT = 'Jun 26, 2026';

const html = fs.readFileSync(tabHome, 'utf8');

function extractTextarea(id) {
  const m = html.match(new RegExp(`id="${id}"[^>]*>\\s*([\\s\\S]*?)\\s*</textarea>`));
  if (!m) throw new Error(`textarea ${id} not found`);
  return JSON.parse(m[1].trim());
}

const ipadMsc = extractTextarea('sheetdata');
const iphoneMsc = extractTextarea('sheetdata1');

const ipadFooters = [
  { index: 1, name: 'Introduction' },
  { index: 2, name: 'Balance Sheet 1' },
  { index: 3, name: 'Balance Sheet 2' },
  { index: 4, name: 'Balance Sheet 3' },
  { index: 5, name: 'Balance Sheet 4' },
  { index: 6, name: 'Balance Sheet 5' },
];

const mobileFooters = [
  { index: 1, name: 'Introduction' },
  { index: 2, name: 'Sheet 1' },
  { index: 3, name: 'Sheet 2' },
  { index: 4, name: 'Sheet 3' },
];

function buildTemplate(msc, footers) {
  const { EditableCells, ...workbook } = msc;
  return {
    mainSheet: 'sheet1',
    msc: workbook,
    footers,
    appMapping: EditableCells ?? { allow: true, cells: {}, constraints: {} },
  };
}

function getCellLine(savestr, ref) {
  const prefix = `cell:${ref}:`;
  return savestr.split('\n').find((line) => line.startsWith(prefix)) ?? '';
}

function getSheetSavestrByName(msc) {
  const map = {};
  for (const sheet of Object.values(msc.sheetArr ?? {})) {
    const savestr = sheet?.sheetstr?.savestr;
    if (!savestr) continue;
    if (sheet.name) map[sheet.name] = savestr;
  }
  return map;
}

function convertDateCellsToText(savestr, device) {
  const dateRef = device === 'mobile' ? 'C5' : 'F5';
  const escapedDate = DATE_TEXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let next = savestr.replace(
    new RegExp(
      `cell:${dateRef}:vtf:ndt:[^\\n:]+:(?:NOW|now)\\(\\)([^\\n]*)`,
      'gi',
    ),
    (_, suffix) => `cell:${dateRef}:t:${DATE_TEXT}${suffix.replace(/:ntvf:\d+/, '')}`,
  );

  next = next.replace(
    new RegExp(`cell:${dateRef}:t:${escapedDate}([^\\n]*):ntvf:\\d+`, 'g'),
    `cell:${dateRef}:t:${DATE_TEXT}$1`,
  );

  return next;
}

function updateYearsInSavestr(savestr, device) {
  let next = savestr;

  if (device === 'mobile') {
    next = next.replace(/cell:C7:v:\d+/g, `cell:C7:v:${CURRENT_YEAR}`);
    next = next.replace(/cell:D7:v:\d+/g, `cell:D7:v:${PRIOR_YEAR}`);
  } else {
    next = next.replace(/cell:E7:v:\d+/g, `cell:E7:v:${CURRENT_YEAR}`);
    next = next.replace(/cell:F7:v:\d+/g, `cell:F7:v:${PRIOR_YEAR}`);
  }

  next = convertDateCellsToText(next, device);

  return next;
}

function getConstraintLabel(savestr, ref, numeric) {
  const line = getCellLine(savestr, ref);
  const textMatch = line.match(/:t:([^:\\]+)/);
  if (textMatch?.[1]) {
    return textMatch[1].replace(/\\c/g, ':').trim();
  }
  if (/^[EF]7$/.test(ref) || /^[CD]7$/.test(ref)) return 'Year';
  if (/^[EF]5$/.test(ref) || ref === 'C5') return 'Date';
  if (numeric) return 'Amount';
  return 'Enter value';
}

function isNumericBalanceSheetCell(ref, device) {
  const col = ref.replace(/[0-9]+/g, '');

  if (ref === 'F5' || ref === 'C5') return false;

  if (device === 'mobile') {
    if (col === 'B') return false;
    if (ref === 'C4' || ref === 'D4') return false;
    if (col === 'C' || col === 'D') return true;
    return false;
  }

  if (col === 'C' || col === 'D') return false;
  if (ref === 'E4' || ref === 'F4' || ref === 'E5') return false;
  if (col === 'E' || col === 'F') return true;
  return false;
}

function buildConstraints(appMapping, msc, device) {
  const savestrBySheet = getSheetSavestrByName(msc);
  const constraints = {};

  for (const cellKey of Object.keys(appMapping.cells ?? {})) {
    const bang = cellKey.indexOf('!');
    if (bang < 0) continue;
    const sheetName = cellKey.slice(0, bang);
    const ref = cellKey.slice(bang + 1);
    const savestr = savestrBySheet[sheetName] ?? '';
    const numeric = isNumericBalanceSheetCell(ref, device);
    const label = getConstraintLabel(savestr, ref, numeric);
    constraints[cellKey] = numeric
      ? ['promptnumeric', '0', '1e10', label, 'Input']
      : ['prompttext', '0', '1e10', label, 'Input'];
  }

  return constraints;
}

function postProcessTemplate(template, device) {
  const { msc, appMapping } = template;

  for (const sheet of Object.values(msc.sheetArr ?? {})) {
    if (!sheet?.sheetstr?.savestr) continue;
    sheet.sheetstr.savestr = updateYearsInSavestr(sheet.sheetstr.savestr, device);
  }

  appMapping.constraints = buildConstraints(appMapping, msc, device);
  return template;
}

const dataDir = path.join(root, 'public/templates/data');
const metaDir = path.join(root, 'public/templates/meta');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(metaDir, { recursive: true });

const templates = [
  { id: 100001, device: 'tablet', name: 'Balance Sheet iPad', footers: ipadFooters, data: buildTemplate(ipadMsc, ipadFooters) },
  { id: 100002, device: 'mobile', name: 'Balance Sheet iPhone', footers: mobileFooters, data: buildTemplate(iphoneMsc, mobileFooters) },
  { id: 100003, device: 'desktop', name: 'Balance Sheet', footers: ipadFooters, data: buildTemplate(ipadMsc, ipadFooters) },
];

for (const t of templates) {
  const layoutDevice = t.device === 'desktop' ? 'tablet' : t.device;
  const data = postProcessTemplate(t.data, layoutDevice);
  fs.writeFileSync(path.join(dataDir, `${t.id}.json`), JSON.stringify(data));
  const meta = {
    id: t.id,
    name: 'Balance Sheet',
    description: t.name,
    type: 'balance-sheet',
    device: t.device,
    image: '/favicon.png',
    isPremium: false,
    price: { USD: 0 },
    hashtags: ['balance-sheet', t.device],
  };
  fs.writeFileSync(path.join(metaDir, `${t.id}-meta.json`), JSON.stringify(meta, null, 2));
  const constraintCount = Object.keys(data.appMapping.constraints).length;
  console.log(`Wrote template ${t.id} (${t.device}) — ${constraintCount} constraints`);
}

console.log('Done importing Balance Sheet templates.');
