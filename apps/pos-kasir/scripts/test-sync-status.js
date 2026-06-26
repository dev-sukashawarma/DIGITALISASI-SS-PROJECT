const { execSync } = require('child_process');
const path = require('path');

console.log('=====================================================');
console.log('🚀 Running Two-Way Order Status Synchronization Tests');
console.log('=====================================================');

try {
  // Execute the vitest runner specifically for sync-status.test.ts
  execSync('npx vitest run tests/sync-status.test.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  console.log('\n✅ All order status sync tests passed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed.');
  process.exit(1);
}
