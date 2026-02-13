import { Command } from 'commander';
import kleur from 'kleur';
import { collectData, saveToBson } from '../src/collector';

kleur.enabled = true;

const DEFAULT_OUTPUT = 'data/polymarket-data.bson';

const program = new Command();

program
  .name('collect')
  .description('Polymarket Data Collector')
  .option('-l, --limit <number>', 'Number of markets to collect', '50')
  .option('-o, --output <file>', 'Output file path', DEFAULT_OUTPUT)
  .option('-m, --months <number>', 'Number of months of price history to collect (or "all")')
  .action(async (options) => {
    const limit = parseInt(options.limit);
    const months = options.months && options.months.toLowerCase() !== 'all' ? parseInt(options.months) : undefined;

    console.log(kleur.cyan('Polymarket Data Collector'));
    console.log(kleur.cyan('========================='));
    console.log(`Limit:   ${limit} markets`);
    console.log(`Output:  ${options.output}`);
    if (months) {
      console.log(`Months:  ${months}`);
    }
    console.log('');

    try {
      const data = await collectData({ limit, active: true, interval: '1d', months });
      await saveToBson(data, options.output);
      console.log(kleur.green('\n✓ Collection complete!'));
    } catch (error) {
      console.error(kleur.red('Error collecting data:'), error);
      process.exit(1);
    }
  });

program.parse();
