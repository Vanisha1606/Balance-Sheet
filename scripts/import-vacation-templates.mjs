import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const vpHome = '/Users/vanishagarg/Downloads/VacationPlanner1]/www/templates/tab-home.html';

const html = fs.readFileSync(vpHome, 'utf8');
const match = html.match(/id="sheetdata"[^>]*>\s*([\s\S]*?)\s*<\/textarea>/);
if (!match) throw new Error('sheetdata not found in tab-home.html');

const raw = JSON.parse(match[1].trim());
const { EditableCells, ...msc } = raw;

function postProcessSavestr(savestr) {
  return savestr
    .replace(/src="checkmark\.png"/g, 'src="/checkmark.png"')
    .replace(
      /cell:B5:t:<div><img src="\/checkmark\.png"><\/div>/g,
      'cell:B5:t:<div>&nbsp; </div>'
    )
    .split('\n')
    .map((line) => {
      if (!line.startsWith('cell:') || !line.includes(':bg:5')) {
        return line;
      }
      // White text (c:7) needs its background — stripping bg:5 hides labels like "Flight"
      if (line.includes(':c:7')) {
        return line;
      }
      // Text labels on colored section headers also keep their stripe background
      if (/:t:[^:]+/.test(line) && !/:t:<div>/.test(line)) {
        return line;
      }
      // Empty zebra-stripe data rows: use plain white
      return line.replace(/:bg:5/g, '');
    })
    .join('\n');
}

for (const sheetId of Object.keys(msc.sheetArr || {})) {
  const sheet = msc.sheetArr[sheetId];
  if (sheet?.sheetstr?.savestr) {
    sheet.sheetstr.savestr = postProcessSavestr(sheet.sheetstr.savestr);
  }
}

const tabletFooters = [
  { index: 1, name: 'Travel Plan', isActive: true },
  { index: 2, name: 'Travel Reservations', isActive: false },
  { index: 3, name: 'Important Contacts', isActive: false },
  { index: 4, name: 'Travel Budget', isActive: false },
  { index: 5, name: 'Vacation Pack', isActive: false },
  { index: 6, name: 'Vacation Pack', isActive: false },
];

const mobileFooters = [
  { index: 1, name: 'Vacation Planner 1', isActive: true },
  { index: 2, name: 'Vacation Planner 2', isActive: false },
];

function buildTemplate(mainSheet, footers) {
  return {
    mainSheet: mainSheet || 'sheet1',
    msc,
    appMapping: EditableCells ?? { allow: true, cells: {}, constraints: {} },
    footers,
  };
}

const dataDir = path.join(root, 'public/templates/data');
const metaDir = path.join(root, 'public/templates/meta');

const templates = [
  {
    id: 100001,
    device: 'mobile',
    name: 'Vacation Planner',
    description: 'Mobile vacation planner template',
    footers: mobileFooters,
  },
  {
    id: 100002,
    device: 'tablet',
    name: 'Vacation Planner',
    description: 'Tablet vacation planner template',
    footers: tabletFooters,
  },
  {
    id: 100003,
    device: 'desktop',
    name: 'Vacation Planner',
    description: 'Desktop vacation planner template',
    footers: tabletFooters,
  },
];

for (const t of templates) {
  const data = buildTemplate('sheet1', t.footers);
  fs.writeFileSync(path.join(dataDir, `${t.id}.json`), JSON.stringify(data, null, 2));

  const meta = {
    id: t.id,
    name: t.name,
    description: t.description,
    type: 'vacation',
    device: t.device,
    image: '',
    isPremium: false,
    price: { USD: 0 },
    hashtags: ['vacation', 'planner', t.device],
  };
  fs.writeFileSync(path.join(metaDir, `${t.id}-meta.json`), JSON.stringify(meta, null, 2));
  console.log(`Wrote template ${t.id} (${t.device})`);
}

console.log('Done importing Vacation Planner templates.');
