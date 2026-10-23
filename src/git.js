import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @typedef {Object} GitCommitInfo
 * @property {boolean} available - Whether git command worked
 * @property {boolean} tracked - Whether file has a commit timestamp
 * @property {number|null} timestamp - Unix timestamp in seconds
 * @property {Date|null} date - JavaScript Date
 * @property {string} [commit] - Last commit hash
 */

/**
 * Get the last commit timestamp for a file using git.
 * Reads the commit hash and timestamp with `git log -1 --format=%H%n%ct -- <file>`.
 * Returns null / tracked:false gracefully if outside git or untracked.
 * @param {string} filePath
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<GitCommitInfo>}
 */
export async function getFileCommitInfo(filePath, cwd = process.cwd()) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '-1', '--format=%H%n%ct', '--', filePath],
      { cwd, timeout: 5000 }
    );

    const trimmed = stdout.trim();
    if (!trimmed) {
      return {
        available: true,
        tracked: false,
        timestamp: null,
        date: null
      };
    }

    const [commit, time] = trimmed.split('\n');
    const timestamp = parseInt(time, 10);
    if (isNaN(timestamp)) {
      return {
        available: true,
        tracked: false,
        timestamp: null,
        date: null
      };
    }

    return {
      available: true,
      tracked: true,
      timestamp,
      commit,
      date: new Date(timestamp * 1000)
    };
  } catch (err) {
    // Graceful fallback if git is missing, not a repo, or fails
    return {
      available: false,
      tracked: false,
      timestamp: null,
      date: null,
      error: err.message
    };
  }
}

/**
 * Format relative duration between two timestamps.
 * @param {number} diffSeconds
 * @returns {string}
 */
export function formatDuration(diffSeconds) {
  const seconds = Math.abs(diffSeconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * Check staleness between source file and target translation.
 * @param {string} sourcePath
 * @param {string} targetPath
 * @param {string} [cwd=process.cwd()]
 * @param {number} [graceSeconds=0]
 * @returns {Promise<{ isStale: boolean, skipped: boolean, reason?: string, sourceTime?: Date, targetTime?: Date, diffSeconds?: number }>}
 */
export async function checkStaleness(sourcePath, targetPath, cwd = process.cwd(), graceSeconds = 0) {
  const [sourceInfo, targetInfo] = await Promise.all([
    getFileCommitInfo(sourcePath, cwd),
    getFileCommitInfo(targetPath, cwd)
  ]);

  if (!sourceInfo.available || !targetInfo.available) {
    return {
      isStale: false,
      skipped: true,
      reason: 'git is not available or directory is not a git repository'
    };
  }

  if (!sourceInfo.tracked || !targetInfo.tracked) {
    return {
      isStale: false,
      skipped: true,
      reason: 'one or both files are untracked in git history'
    };
  }

  const diff = sourceInfo.timestamp - targetInfo.timestamp;
  const isStale = sourceInfo.commit !== targetInfo.commit && diff > graceSeconds;

  return {
    isStale,
    skipped: false,
    sourceTime: sourceInfo.date,
    targetTime: targetInfo.date,
    diffSeconds: diff
  };
}

/** Refuse writes to modified, staged, conflicted, or untracked targets in git. */
export async function assertTargetClean(targetPath, cwd = process.cwd()) {
  try {
    await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd, timeout: 5000 });
  } catch (err) {
    if (err.code === 'ENOENT' || /not a git repository/i.test(err.stderr || '')) return;
    throw new Error(`Cannot verify git status for "${targetPath}"`);
  }
  const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--untracked-files=all', '--', targetPath], { cwd, timeout: 5000 });
  if (stdout.trim()) throw new Error(`Refusing to overwrite "${targetPath}": uncommitted changes (use --force to override)`);
}
