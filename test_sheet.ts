import { fetchSheetDataset } from './src/lib/sheet.server.ts';

async function run() {
  const data = await fetchSheetDataset();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
