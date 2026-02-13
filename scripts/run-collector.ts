import { collectData, saveToBson } from '../src/collector';

const DEFAULT_OUTPUT = 'data/polymarket-data.bson';

function showHelp() {
  console.log(`
Usage: bun run scripts/run-collector.ts [options]

Options:
  --limit <n>         Number of markets to collect (default: 50)
  --output <file>     Output file path (default: data/polymarket-data.bson)
  --months <n>        Number of months of price history to collect (default: all)
  --help, -h          Show this help
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : 50;

  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : DEFAULT_OUTPUT;

  const monthsIndex = args.indexOf('--months');
  let months: number | undefined = undefined;
  if (monthsIndex >= 0) {
    const monthsValue = args[monthsIndex + 1];
    if (monthsValue && monthsValue.toLowerCase() !== 'all') {
      months = parseInt(monthsValue);
    }
  }

  console.log('Polymarket Data Collector');
  console.log('=========================');
  console.log(`Limit: ${limit} markets`);
  console.log(`Output: ${output}`);
  if (months) {
    console.log(`Months: ${months}`);
  }
  console.log('');

  try {
    const data = await collectData({ limit, active: true, interval: '1d', months });
    await saveToBson(data, output);
    console.log('\nCollection complete!');
  } catch (error) {
    console.error('Error collecting data:', error);
    process.exit(1);
  }
}

main();
