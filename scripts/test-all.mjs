import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Database tests create and remove their own bevdist_test_* database.
// They never run migrations or fixtures against the configured application DB.
const checks = [
  ['mobileFrontend', ['run', 'lint']],
  ['mobileFrontend', ['run', 'typecheck']],
  ['mobileFrontend', ['run', 'test:unit']],
  ['mobileFrontend', ['run', 'test:coverage']],
  ['mobileBackend', ['run', 'test:db']],
];
for (const [directory, args] of checks) {
  console.log(`\n${directory}: npm ${args.join(' ')}`);
  const result = spawnSync('npm', args, {
    cwd: fileURLToPath(new URL(`../${directory}/`, import.meta.url)),
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nAll automated checks passed. Device and visual checks remain separate.');
