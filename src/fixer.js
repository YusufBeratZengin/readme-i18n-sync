import { readFile, writeFile } from 'node:fs/promises';
import { parseMarkdown } from './parser.js';

/**
 * @typedef {Object} FixResult
 * @property {boolean} fixed - Whether any code blocks were updated
 * @property {number} fixedCount - Number of code blocks replaced
 * @property {string} newContent - Updated document content
 * @property {string} [error] - Error message if fix cannot be performed
 */

/**
 * Copy code blocks from source markdown into target translation where code differs.
 * @param {string} sourceMarkdown
 * @param {string} targetMarkdown
 * @returns {FixResult}
 */
export function fixCodeBlocks(sourceMarkdown, targetMarkdown) {
  const sourceDoc = parseMarkdown(sourceMarkdown);
  const targetDoc = parseMarkdown(targetMarkdown);

  const sBlocks = sourceDoc.codeBlocks.filter(b => !b.ignored);
  const tBlocks = targetDoc.codeBlocks.filter(b => !b.ignored);

  if (sBlocks.length === 0 || tBlocks.length === 0) {
    return { fixed: false, fixedCount: 0, newContent: targetMarkdown };
  }

  // Determine matches to fix
  const replacements = [];
  const minLen = Math.min(sBlocks.length, tBlocks.length);

  for (let i = 0; i < minLen; i++) {
    const sB = sBlocks[i];
    const tB = tBlocks[i];

    const contentDiffers = sB.content !== tB.content;
    const langDiffers = sB.lang !== tB.lang;

    if (contentDiffers || langDiffers) {
      // Build replacement lines
      const fenceChar = sB.fence || '```';
      const lang = sB.lang || '';
      const opening = `${tB.indent}${fenceChar}${lang}`;
      const closing = `${tB.indent}${fenceChar}`;

      const blockLines = [opening];
      if (sB.content.length > 0) {
        blockLines.push(sB.content);
      }
      blockLines.push(closing);

      replacements.push({
        startLineIndex: tB.startLine - 1,
        endLineIndex: tB.endLine - 1,
        replacementText: blockLines.join('\n')
      });
    }
  }

  if (replacements.length === 0) {
    return { fixed: false, fixedCount: 0, newContent: targetMarkdown };
  }

  // Apply replacements from bottom to top to preserve line indices
  replacements.sort((a, b) => b.startLineIndex - a.startLineIndex);

  const targetLines = targetDoc.rawLines.slice();
  for (const rep of replacements) {
    const deleteCount = rep.endLineIndex - rep.startLineIndex + 1;
    targetLines.splice(rep.startLineIndex, deleteCount, rep.replacementText);
  }

  const newContent = targetLines.join('\n');
  return {
    fixed: true,
    fixedCount: replacements.length,
    newContent
  };
}

/**
 * Fix code blocks in a target file directly on disk.
 * @param {string} sourcePath
 * @param {string} targetPath
 * @returns {Promise<{ fixed: boolean, fixedCount: number, error?: string }>}
 */
export async function fixCodeBlocksInFile(sourcePath, targetPath) {
  try {
    const [sourceContent, targetContent] = await Promise.all([
      readFile(sourcePath, 'utf8'),
      readFile(targetPath, 'utf8')
    ]);

    const result = fixCodeBlocks(sourceContent, targetContent);
    if (result.fixed) {
      await writeFile(targetPath, result.newContent, 'utf8');
    }

    return {
      fixed: result.fixed,
      fixedCount: result.fixedCount
    };
  } catch (err) {
    return {
      fixed: false,
      fixedCount: 0,
      error: err.message
    };
  }
}
