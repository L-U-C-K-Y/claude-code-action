/**
 * Minimal shim for @actions/core to use outside GitHub Actions
 */

export function warning(message: string) {
  console.warn(`⚠️  ${message}`);
}

export function setOutput(name: string, value: string) {
  console.log(`📤 Output: ${name}=${value}`);
  // In GitLab CI, we could write to a file or use CI variables
  // For now, just log it
}

export function info(message: string) {
  console.log(`ℹ️  ${message}`);
}

export function error(message: string) {
  console.error(`❌ ${message}`);
}

export function setFailed(message: string) {
  console.error(`❌ Failed: ${message}`);
  process.exit(1);
}