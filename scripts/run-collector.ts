import { collectData, saveToBson } from '../src/collector';

const DEFAULT_OUTPUT = 'data/polymarket-data.bson';

async function main() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : 50;

  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : DEFAULT_OUTPUT;

  console.log('Polymarket Data Collector');
  console.log('=========================');
  console.log(`Limit: ${limit} markets`);
  console.log(`Output: ${output}`);
  console.log('');

  try {
    const data = await collectData({ limit, active: true, interval: '1d' });
    await saveToBson(data, output);
    console.log('\nCollection complete!');
  } catch (error) {
    console.error('Error collecting data:', error);
    process.exit(1);
  }
}

main();
