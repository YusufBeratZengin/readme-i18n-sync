import { formatDuration } from './git.js';

/**
 * @typedef {Object} ComparisonIssue
 * @property {string} check - Category of check (headings, codeBlocks, etc.)
 * @property {'warning'|'error'} severity
 * @property {string} message
 * @property {number} line - Target line number
 * @property {number} [sourceLine]
 * @property {any} [details]
 */

/**
 * @typedef {Object} ComparisonResult
 * @property {string} sourcePath
 * @property {string} targetPath
 * @property {string} language
 * @property {boolean} synced - True if zero issues
 * @property {ComparisonIssue[]} issues
 * @property {object} summary - Counters by category
 */

/**
 * Compare source and target parsed documents structurally.
 * @param {import('./parser.js').ParsedDocument} sourceDoc
 * @param {import('./parser.js').ParsedDocument} targetDoc
 * @param {object} [options]
 * @param {object} [options.checks]
 * @param {boolean} [options.checks.headings=true]
 * @param {boolean} [options.checks.codeBlocks=true]
 * @param {boolean} [options.checks.codeBlocksIdentical=true]
 * @param {boolean} [options.checks.links=true]
 * @param {boolean} [options.checks.images=true]
 * @param {boolean} [options.checks.tables=true]
 * @param {boolean} [options.checks.admonitions=true]
 * @param {boolean} [options.checks.versions=true]
 * @param {boolean} [options.checks.gitStaleness=true]
 * @param {object} [options.gitInfo]
 * @param {string} [options.sourcePath]
 * @param {string} [options.targetPath]
 * @param {string} [options.language]
 * @returns {ComparisonResult}
 */
export function compareDocuments(sourceDoc, targetDoc, options = {}) {
  const checks = {
    headings: true,
    codeBlocks: true,
    codeBlocksIdentical: true,
    links: true,
    images: true,
    tables: true,
    admonitions: true,
    versions: true,
    gitStaleness: true,
    ...(options.checks || {})
  };

  const issues = [];

  // 1. Headings check
  if (checks.headings) {
    const sHeadings = sourceDoc.headings.filter(h => !h.ignored);
    const tHeadings = targetDoc.headings.filter(h => !h.ignored);

    if (sHeadings.length !== tHeadings.length) {
      issues.push({
        check: 'headings',
        severity: 'warning',
        message: `Heading count mismatch: source has ${sHeadings.length} headings, target has ${tHeadings.length}`,
        line: tHeadings[0]?.line || 1,
        details: { expected: sHeadings.length, actual: tHeadings.length }
      });
    }

    const minLen = Math.min(sHeadings.length, tHeadings.length);
    for (let i = 0; i < minLen; i++) {
      const sH = sHeadings[i];
      const tH = tHeadings[i];

      if (sH.level !== tH.level) {
        issues.push({
          check: 'headings',
          severity: 'warning',
          message: `Heading #${i + 1} level mismatch: source has H${sH.level} ("${sH.text}"), target has H${tH.level} ("${tH.text}")`,
          line: tH.line,
          sourceLine: sH.line,
          details: { expectedLevel: sH.level, actualLevel: tH.level }
        });
      }
    }

    if (tHeadings.length < sHeadings.length) {
      for (let i = minLen; i < sHeadings.length; i++) {
        const sH = sHeadings[i];
        issues.push({
          check: 'headings',
          severity: 'warning',
          message: `Missing heading from source: H${sH.level} ("${sH.text}")`,
          line: tHeadings[tHeadings.length - 1]?.line || 1,
          sourceLine: sH.line,
          details: { missingLevel: sH.level, missingText: sH.text }
        });
      }
    } else if (tHeadings.length > sHeadings.length) {
      for (let i = minLen; i < tHeadings.length; i++) {
        const tH = tHeadings[i];
        issues.push({
          check: 'headings',
          severity: 'warning',
          message: `Extra heading in target: H${tH.level} ("${tH.text}")`,
          line: tH.line,
          details: { extraLevel: tH.level, extraText: tH.text }
        });
      }
    }
  }

  // 2. Code blocks check
  if (checks.codeBlocks) {
    const sBlocks = sourceDoc.codeBlocks.filter(b => !b.ignored);
    const tBlocks = targetDoc.codeBlocks.filter(b => !b.ignored);

    if (sBlocks.length !== tBlocks.length) {
      issues.push({
        check: 'codeBlocks',
        severity: 'warning',
        message: `Code block count mismatch: source has ${sBlocks.length} code blocks, target has ${tBlocks.length}`,
        line: tBlocks[0]?.startLine || 1,
        details: { expected: sBlocks.length, actual: tBlocks.length }
      });
    }

    const minLen = Math.min(sBlocks.length, tBlocks.length);
    for (let i = 0; i < minLen; i++) {
      const sB = sBlocks[i];
      const tB = tBlocks[i];

      // Language check
      if (sB.lang !== tB.lang) {
        issues.push({
          check: 'codeBlocks',
          severity: 'warning',
          message: `Code block #${i + 1} language mismatch: source has "${sB.lang || 'none'}", target has "${tB.lang || 'none'}"`,
          line: tB.startLine,
          sourceLine: sB.startLine,
          details: { expectedLang: sB.lang, actualLang: tB.lang }
        });
      }

      // Byte-identical content check
      if (checks.codeBlocksIdentical) {
        if (sB.content !== tB.content) {
          issues.push({
            check: 'codeBlocks',
            severity: 'warning',
            message: `Code block #${i + 1} content differs from source`,
            line: tB.startLine,
            sourceLine: sB.startLine,
            details: {
              codeBlockIndex: i,
              sourceContent: sB.content,
              targetContent: tB.content
            }
          });
        }
      }
    }
  }

  // 3. Links check
  if (checks.links) {
    const sLinks = sourceDoc.links.filter(l => !l.ignored);
    const tLinks = targetDoc.links.filter(l => !l.ignored);

    const sTargets = new Set(sLinks.map(l => l.href));
    const tTargets = new Set(tLinks.map(l => l.href));

    // Check missing link targets
    for (const sL of sLinks) {
      if (!tTargets.has(sL.href)) {
        issues.push({
          check: 'links',
          severity: 'warning',
          message: `Missing link target in translation: "${sL.href}"`,
          line: tLinks[0]?.line || 1,
          sourceLine: sL.line,
          details: { missingHref: sL.href }
        });
      }
    }

    // Check extra link targets
    for (const tL of tLinks) {
      if (!sTargets.has(tL.href)) {
        issues.push({
          check: 'links',
          severity: 'warning',
          message: `Extra link target in translation: "${tL.href}"`,
          line: tL.line,
          details: { extraHref: tL.href }
        });
      }
    }
  }

  // 4. Images check
  if (checks.images) {
    const sImgs = sourceDoc.images.filter(img => !img.ignored);
    const tImgs = targetDoc.images.filter(img => !img.ignored);

    if (sImgs.length !== tImgs.length) {
      issues.push({
        check: 'images',
        severity: 'warning',
        message: `Image count mismatch: source has ${sImgs.length} images, target has ${tImgs.length}`,
        line: tImgs[0]?.line || 1,
        details: { expected: sImgs.length, actual: tImgs.length }
      });
    }

    const tSources = new Set(tImgs.map(img => img.src));
    for (const sImg of sImgs) {
      if (!tSources.has(sImg.src)) {
        issues.push({
          check: 'images',
          severity: 'warning',
          message: `Missing image source in translation: "${sImg.src}"`,
          line: tImgs[0]?.line || 1,
          sourceLine: sImg.line,
          details: { missingSrc: sImg.src }
        });
      }
    }
  }

  // 5. Tables check
  if (checks.tables) {
    const sTables = sourceDoc.tables.filter(t => !t.ignored);
    const tTables = targetDoc.tables.filter(t => !t.ignored);

    if (sTables.length !== tTables.length) {
      issues.push({
        check: 'tables',
        severity: 'warning',
        message: `Table count mismatch: source has ${sTables.length} tables, target has ${tTables.length}`,
        line: tTables[0]?.startLine || 1,
        details: { expected: sTables.length, actual: tTables.length }
      });
    }

    const minLen = Math.min(sTables.length, tTables.length);
    for (let i = 0; i < minLen; i++) {
      const sT = sTables[i];
      const tT = tTables[i];

      if (sT.columns !== tT.columns) {
        issues.push({
          check: 'tables',
          severity: 'warning',
          message: `Table #${i + 1} column count mismatch: source has ${sT.columns} columns, target has ${tT.columns}`,
          line: tT.startLine,
          sourceLine: sT.startLine,
          details: { expectedColumns: sT.columns, actualColumns: tT.columns }
        });
      }
    }
  }

  // 6. Admonitions check
  if (checks.admonitions) {
    const sAdms = sourceDoc.admonitions.filter(a => !a.ignored);
    const tAdms = targetDoc.admonitions.filter(a => !a.ignored);

    if (sAdms.length !== tAdms.length) {
      issues.push({
        check: 'admonitions',
        severity: 'warning',
        message: `Admonition count mismatch: source has ${sAdms.length} admonitions, target has ${tAdms.length}`,
        line: tAdms[0]?.line || 1,
        details: { expected: sAdms.length, actual: tAdms.length }
      });
    }

    const minLen = Math.min(sAdms.length, tAdms.length);
    for (let i = 0; i < minLen; i++) {
      if (sAdms[i].type !== tAdms[i].type) {
        issues.push({
          check: 'admonitions',
          severity: 'warning',
          message: `Admonition #${i + 1} type mismatch: source has [!${sAdms[i].type}], target has [!${tAdms[i].type}]`,
          line: tAdms[i].line,
          sourceLine: sAdms[i].line,
          details: { expectedType: sAdms[i].type, actualType: tAdms[i].type }
        });
      }
    }
  }

  // 7. Versions check
  if (checks.versions) {
    const sVers = sourceDoc.versions.filter(v => !v.ignored);
    const tVers = targetDoc.versions.filter(v => !v.ignored);

    const sVersionSet = new Set(sVers.map(v => v.version));
    const tVersionSet = new Set(tVers.map(v => v.version));

    for (const sV of sVers) {
      if (!tVersionSet.has(sV.version)) {
        issues.push({
          check: 'versions',
          severity: 'warning',
          message: `Version mismatch: source version "${sV.version}" not found in translation`,
          line: tVers[0]?.line || 1,
          sourceLine: sV.line,
          details: { missingVersion: sV.version }
        });
      }
    }

    for (const tV of tVers) {
      if (!sVersionSet.has(tV.version)) {
        issues.push({
          check: 'versions',
          severity: 'warning',
          message: `Outdated or extra version: translation mentions version "${tV.version}", not found in source`,
          line: tV.line,
          details: { extraVersion: tV.version }
        });
      }
    }
  }

  // 8. Git staleness check
  if (checks.gitStaleness && options.gitInfo) {
    if (options.gitInfo.isStale) {
      const diffStr = formatDuration(options.gitInfo.diffSeconds);
      const sourceDateStr = options.gitInfo.sourceTime?.toISOString().split('T')[0] || 'unknown';
      const targetDateStr = options.gitInfo.targetTime?.toISOString().split('T')[0] || 'unknown';

      issues.push({
        check: 'gitStaleness',
        severity: 'warning',
        message: `Translation is stale: source changed on ${sourceDateStr} (${diffStr} after target's commit on ${targetDateStr})`,
        line: 1,
        details: {
          sourceTime: options.gitInfo.sourceTime,
          targetTime: options.gitInfo.targetTime,
          diffSeconds: options.gitInfo.diffSeconds
        }
      });
    }
  }

  return {
    sourcePath: options.sourcePath || 'source.md',
    targetPath: options.targetPath || 'target.md',
    language: options.language || 'unknown',
    synced: issues.length === 0,
    issues,
    summary: {
      total: issues.length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      errors: issues.filter(i => i.severity === 'error').length
    }
  };
}
