import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * @typedef {Object} GitCommitInfo
 * @property {boolean} available - Whether git command worked
 * @property {boolean} tracked - Whether file has a commit timestamp
 * @property {number|null} timestamp - Unix timestamp in seconds
 * @property {Date|null} date - JavaScript Date
 */

/**
 * Get the last commit timestamp for a file using git.
 * Runs: `git log -1 --format=%ct -- <file>`
 * Returns null / tracked:false gracefully if outside git or untracked.
 * @param {string} filePath
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<GitCommitInfo>}
 */
export async function getFileCommitInfo(filePath, cwd = process.cwd()) {
  try {
    const { stdout, stderr } = await execFileAsync(
      'git',
      ['log', '-1', '--format=%ct', '--', filePath],
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

    const timestamp = parseInt(trimmed, 10);
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
 * @returns {Promise<{ isStale: boolean, skipped: boolean, reason?: string, sourceTime?: Date, targetTime?: Date, diffSeconds?: number }>}
 */
export async function checkStaleness(sourcePath, targetPath, cwd = process.cwd()) {
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
  const isStale = diff > 0;

  return {
    isStale,
    skipped: false,
    sourceTime: sourceInfo.date,
    targetTime: targetInfo.date,
    diffSeconds: diff
  };
}
