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
  .option('--active-only', 'Only collect active (non-closed) markets', false)
  .option('--min-points <number>', 'Minimum price history data points per token (filters out sparse markets)', '0')
  .option('--fidelity <number>', 'Minutes between data points (15=15min, 60=hourly)', '15')
  .option('--min-volume <number>', 'Minimum market volume in USD (auto-set to 500k when min-points>=100)', '0')
  .action(async (options) => {
    const limit = parseInt(options.limit);
    const months = options.months && options.months.toLowerCase() !== 'all' ? parseInt(options.months) : undefined;
    const activeOnly = options.activeOnly;
    const minPoints = parseInt(options.minPoints);
    const fidelity = parseInt(options.fidelity);
    const minVolume = parseInt(options.minVolume);

    console.log(kleur.cyan('Polymarket Data Collector'));
    console.log(kleur.cyan('========================='));
    console.log(`Limit:     ${limit} markets`);
    console.log(`Output:    ${options.output}`);
    console.log(`Fidelity:  ${fidelity} min (1 data point per ${fidelity} minutes)`);
    console.log(`Filter:    ${activeOnly ? 'active only' : 'all markets (including closed)'}`);
    if (minPoints > 0) {
      console.log(`Min pts:   ${minPoints} per token`);
    }
    if (minVolume > 0) {
      console.log(`Min vol:   $${minVolume.toLocaleString()}`);
    }
    if (months) {
      console.log(`Months:    ${months}`);
    }
    console.log('');

    try {
      const data = await collectData({ limit, active: activeOnly, interval: 'max', months, minPoints, fidelity, minVolume });
      await saveToBson(data, options.output);
      console.log(kleur.green('\n✓ Collection complete!'));
    } catch (error) {
      console.error(kleur.red('Error collecting data:'), error);
      process.exit(1);
    }
  });

program.parse();
