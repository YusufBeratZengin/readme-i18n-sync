import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegex, matchGlob, normalizePath, walkDirectory } from '../src/utils.js';

describe('Utils', () => {
  test('normalizePath converts backslashes to forward slashes', () => {
    assert.equal(normalizePath('foo\\bar\\baz.md'), 'foo/bar/baz.md');
    assert.equal(normalizePath('foo/bar/baz.md'), 'foo/bar/baz.md');
  });

  test('matchGlob supports glob patterns including *, ?, and **', () => {
    assert.equal(matchGlob('README.md', 'README.*'), true);
    assert.equal(matchGlob('README.md', 'README.txt'), false);
    assert.equal(matchGlob('file1.md', 'file?.md'), true);
    assert.equal(matchGlob('file12.md', 'file?.md'), false);
    assert.equal(matchGlob('docs/sub/guide.md', 'docs/**/guide.md'), true);
    assert.equal(matchGlob('docs/sub/deep/guide.md', 'docs/**.md'), true);
  });

  test('globToRegex escapes special characters and builds anchored regex', () => {
    const regex = globToRegex('file+(1).md');
    assert.equal(regex.test('file+(1).md'), true);
    assert.equal(regex.test('file1.md'), false);
  });

  test('walkDirectory returns empty array for nonexistent directory', async () => {
    const files = await walkDirectory('nonexistent-directory-xyz-123');
    assert.deepEqual(files, []);
  });
});
