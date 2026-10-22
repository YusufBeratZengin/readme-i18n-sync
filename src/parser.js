/**
 * Markdown Block & Inline Parser with zero runtime dependencies.
 * Extracts structural elements: headings, code blocks, tables, lists,
 * links, images, admonitions, version strings, and respects ignore markers.
 */

// Regular expressions for markdown parsing
const ATX_HEADING_REGEX = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;
const SETEXT_H1_REGEX = /^={2,}\s*$/;
const SETEXT_H2_REGEX = /^-{2,}\s*$/;
const FENCE_OPEN_REGEX = /^(\s*)(`{3,}|~{3,})(.*)$/;
const LIST_ITEM_REGEX = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const ADMONITION_REGEX = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+(.*))?$/i;
const INLINE_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const INLINE_LINK_REGEX = /(?<!\!)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const AUTOLINK_REGEX = /<(https?:\/\/[^\s>]+|mailto:[^\s>]+)>/g;
const SEMVER_REGEX = /\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)\b/g;

// Ignore markers
const IGNORE_SINGLE_REGEX = /<!--\s*i18n-sync-ignore\s*-->/i;
const IGNORE_START_REGEX = /<!--\s*i18n-sync-ignore-start\s*-->/i;
const IGNORE_END_REGEX = /<!--\s*i18n-sync-ignore-end\s*-->/i;

/**
 * Check if a line is a markdown table delimiter row.
 * e.g. | --- | :---: | ---: |
 * @param {string} line
 * @returns {boolean}
 */
export function isTableDelimiter(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const parts = trimmed.split('|').map(s => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(part => /^:?-+:?$/.test(part));
}

/**
 * @typedef {Object} Heading
 * @property {number} level - 1 through 6
 * @property {string} text - Clean heading text
 * @property {number} line - 1-based line number
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} CodeBlock
 * @property {string} lang - Language identifier (e.g. 'js', 'sh')
 * @property {string} content - Raw inner code content
 * @property {number} startLine - 1-based start line
 * @property {number} endLine - 1-based end line
 * @property {string} fence - The fence string, e.g. '```'
 * @property {string} indent - Leading indentation
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} Table
 * @property {number} columns - Number of columns
 * @property {number} rows - Number of data rows (excluding header and delimiter)
 * @property {number} startLine - 1-based start line
 * @property {number} endLine - 1-based end line
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} ListItem
 * @property {number} level - Indentation level
 * @property {boolean} ordered - Ordered or unordered
 * @property {string} text - Item text
 * @property {number} line - 1-based line number
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} Link
 * @property {string} text - Link text
 * @property {string} href - Link target URL
 * @property {number} line - 1-based line number
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} Image
 * @property {string} alt - Image alt text
 * @property {string} src - Image source URL
 * @property {number} line - 1-based line number
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} Admonition
 * @property {string} type - NOTE, TIP, IMPORTANT, WARNING, CAUTION
 * @property {number} line - 1-based line number
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} VersionItem
 * @property {string} version - Semver string
 * @property {number} line - 1-based line number
 * @property {boolean} ignored - Whether ignored via marker
 */

/**
 * @typedef {Object} ParsedDocument
 * @property {Heading[]} headings
 * @property {CodeBlock[]} codeBlocks
 * @property {Table[]} tables
 * @property {ListItem[]} listItems
 * @property {Link[]} links
 * @property {Image[]} images
 * @property {Admonition[]} admonitions
 * @property {VersionItem[]} versions
 * @property {string[]} rawLines
 */

/**
 * Parse a markdown string into structural elements.
 * @param {string} content
 * @returns {ParsedDocument}
 */
export function parseMarkdown(content) {
  // Normalize line endings to \n
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const headings = [];
  const codeBlocks = [];
  const tables = [];
  const listItems = [];
  const links = [];
  const images = [];
  const admonitions = [];
  const versions = [];

  let inIgnoreRegion = false;
  let nextElementIgnored = false;

  let inCodeBlock = false;
  let codeFenceChar = '';
  let codeFenceLength = 0;
  let codeLang = '';
  let codeIndent = '';
  let codeStartLine = 0;
  let codeLines = [];
  let codeBlockIgnored = false;

  let inTable = false;
  let tableStartLine = 0;
  let tableColumns = 0;
  let tableRows = 0;
  let tableIgnored = false;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const line = rawLines[i];
    const trimmed = line.trim();

    // Check for ignore markers
    if (IGNORE_START_REGEX.test(line)) {
      inIgnoreRegion = true;
      continue;
    }
    if (IGNORE_END_REGEX.test(line)) {
      inIgnoreRegion = false;
      continue;
    }
    if (IGNORE_SINGLE_REGEX.test(line)) {
      nextElementIgnored = true;
      continue;
    }

    const isCurrentIgnored = inIgnoreRegion || nextElementIgnored;

    // Handle Fenced Code Blocks
    if (inCodeBlock) {
      // Check if closing fence
      const closeFencePattern = new RegExp(`^\\s*${codeFenceChar}{${codeFenceLength},}\\s*$`);
      if (closeFencePattern.test(line)) {
        codeBlocks.push({
          lang: codeLang,
          content: codeLines.join('\n'),
          startLine: codeStartLine,
          endLine: lineNumber,
          fence: codeFenceChar.repeat(codeFenceLength),
          indent: codeIndent,
          ignored: codeBlockIgnored
        });
        inCodeBlock = false;
        codeLines = [];
        codeLang = '';
        codeIndent = '';
        codeBlockIgnored = false;
        continue;
      }

      codeLines.push(line);
      continue;
    }

    const fenceMatch = line.match(FENCE_OPEN_REGEX);
    if (fenceMatch) {
      inCodeBlock = true;
      codeIndent = fenceMatch[1];
      const fenceStr = fenceMatch[2];
      codeFenceChar = fenceStr[0];
      codeFenceLength = fenceStr.length;
      codeLang = (fenceMatch[3] || '').trim().split(/\s+/)[0];
      codeStartLine = lineNumber;
      codeLines = [];
      codeBlockIgnored = isCurrentIgnored;
      nextElementIgnored = false;
      continue;
    }

    // Handle Tables
    if (!inTable && trimmed.includes('|') && i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1];
      if (isTableDelimiter(nextLine)) {
        inTable = true;
        tableStartLine = lineNumber;
        tableIgnored = isCurrentIgnored;
        nextElementIgnored = false;

        const delimiterParts = nextLine.split('|').map(s => s.trim()).filter(Boolean);
        tableColumns = delimiterParts.length;
        tableRows = 0;

        // Extract links/images from header line
        extractInlines(line, lineNumber, isCurrentIgnored, links, images, versions);

        // Advance to delimiter row
        i++;
        continue;
      }
    } else if (inTable) {
      if (trimmed === '' || !trimmed.includes('|')) {
        // Table ended
        tables.push({
          columns: tableColumns,
          rows: tableRows,
          startLine: tableStartLine,
          endLine: lineNumber - 1,
          ignored: tableIgnored
        });
        inTable = false;
        tableRows = 0;
        tableColumns = 0;
      } else {
        tableRows++;
        extractInlines(line, lineNumber, tableIgnored, links, images, versions);
        continue;
      }
    }

    // Handle ATX Headings
    const atxMatch = line.match(ATX_HEADING_REGEX);
    if (atxMatch) {
      const level = atxMatch[1].length;
      const text = atxMatch[2].trim();
      headings.push({
        level,
        text,
        line: lineNumber,
        ignored: isCurrentIgnored
      });
      nextElementIgnored = false;

      extractInlines(text, lineNumber, isCurrentIgnored, links, images, versions);
      continue;
    }

    // Handle Setext Headings
    if (i + 1 < rawLines.length && trimmed !== '' && !line.startsWith('>')) {
      const nextLine = rawLines[i + 1].trim();
      let setextLevel = 0;
      if (SETEXT_H1_REGEX.test(nextLine)) {
        setextLevel = 1;
      } else if (SETEXT_H2_REGEX.test(nextLine) && !LIST_ITEM_REGEX.test(line)) {
        setextLevel = 2;
      }

      if (setextLevel > 0) {
        headings.push({
          level: setextLevel,
          text: trimmed,
          line: lineNumber,
          ignored: isCurrentIgnored
        });
        nextElementIgnored = false;

        extractInlines(trimmed, lineNumber, isCurrentIgnored, links, images, versions);
        i++; // skip underline
        continue;
      }
    }

    // Handle Admonitions (GitHub alert style: > [!NOTE])
    const admonitionMatch = line.match(ADMONITION_REGEX);
    if (admonitionMatch) {
      admonitions.push({
        type: admonitionMatch[1].toUpperCase(),
        line: lineNumber,
        ignored: isCurrentIgnored
      });
      nextElementIgnored = false;
    }

    // Handle List Items
    const listMatch = line.match(LIST_ITEM_REGEX);
    if (listMatch) {
      const indent = listMatch[1].length;
      const marker = listMatch[2];
      const isOrdered = /^\d+[.)]$/.test(marker);
      const text = listMatch[3].trim();
      listItems.push({
        level: Math.floor(indent / 2),
        ordered: isOrdered,
        text,
        line: lineNumber,
        ignored: isCurrentIgnored
      });
      nextElementIgnored = false;
    }

    // Extract inline items (links, images, versions)
    extractInlines(line, lineNumber, isCurrentIgnored, links, images, versions);

    // If an ignore marker wasn't consumed by a block, clear it when line is processed
    if (nextElementIgnored && trimmed !== '') {
      nextElementIgnored = false;
    }
  }

  // If file ended while still in table
  if (inTable) {
    tables.push({
      columns: tableColumns,
      rows: tableRows,
      startLine: tableStartLine,
      endLine: rawLines.length,
      ignored: tableIgnored
    });
  }

  return {
    headings,
    codeBlocks,
    tables,
    listItems,
    links,
    images,
    admonitions,
    versions,
    rawLines
  };
}

/**
 * Extract inlines (images, links, versions) from a line of text.
 * @param {string} text
 * @param {number} lineNumber
 * @param {boolean} ignored
 * @param {Link[]} links
 * @param {Image[]} images
 * @param {VersionItem[]} versions
 */
function extractInlines(text, lineNumber, ignored, links, images, versions) {
  // Extract images first (so ![alt](src) doesn't get captured as link)
  let imgMatch;
  INLINE_IMAGE_REGEX.lastIndex = 0;
  while ((imgMatch = INLINE_IMAGE_REGEX.exec(text)) !== null) {
    images.push({
      alt: imgMatch[1],
      src: imgMatch[2],
      line: lineNumber,
      ignored
    });
  }

  // Extract links
  let linkMatch;
  INLINE_LINK_REGEX.lastIndex = 0;
  while ((linkMatch = INLINE_LINK_REGEX.exec(text)) !== null) {
    links.push({
      text: linkMatch[1],
      href: linkMatch[2],
      line: lineNumber,
      ignored
    });
  }

  // Autolinks <http...>
  let autoMatch;
  AUTOLINK_REGEX.lastIndex = 0;
  while ((autoMatch = AUTOLINK_REGEX.exec(text)) !== null) {
    links.push({
      text: autoMatch[1],
      href: autoMatch[1],
      line: lineNumber,
      ignored
    });
  }

  // Extract semver versions
  let verMatch;
  SEMVER_REGEX.lastIndex = 0;
  while ((verMatch = SEMVER_REGEX.exec(text)) !== null) {
    const ver = verMatch[1];
    versions.push({
      version: ver,
      line: lineNumber,
      ignored
    });
  }
}
