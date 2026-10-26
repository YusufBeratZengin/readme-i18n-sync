import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/parser.js';

describe('Markdown Parser', () => {
  test('parses ATX headings (levels 1-6 and trailing hashes)', () => {
    const md = `
# Level 1
## Level 2
### Level 3 ###
#### Level 4
##### Level 5
###### Level 6
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.headings.length, 6);
    assert.deepEqual(doc.headings.map(h => h.level), [1, 2, 3, 4, 5, 6]);
    assert.equal(doc.headings[2].text, 'Level 3');
  });

  test('parses Setext headings (level 1 and 2)', () => {
    const md = `
Setext One
==========

Setext Two
----------
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.headings.length, 2);
    assert.equal(doc.headings[0].level, 1);
    assert.equal(doc.headings[0].text, 'Setext One');
    assert.equal(doc.headings[1].level, 2);
    assert.equal(doc.headings[1].text, 'Setext Two');
  });

  test('parses fenced code blocks with backticks and tildes', () => {
    const md = `
\`\`\`js
const x = 42;
console.log(x);
\`\`\`

~~~bash
echo "hello world"
~~~
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.codeBlocks.length, 2);
    assert.equal(doc.codeBlocks[0].lang, 'js');
    assert.equal(doc.codeBlocks[0].content, 'const x = 42;\nconsole.log(x);');
    assert.equal(doc.codeBlocks[0].fence, '```');
    assert.equal(doc.codeBlocks[1].lang, 'bash');
    assert.equal(doc.codeBlocks[1].content, 'echo "hello world"');
    assert.equal(doc.codeBlocks[1].fence, '~~~');
  });

  test('parses tables and counts rows and columns', () => {
    const md = `
| Col 1 | Col 2 | Col 3 |
| --- | :---: | ---: |
| Row 1 | Val A | 100 |
| Row 2 | Val B | 200 |
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.tables.length, 1);
    assert.equal(doc.tables[0].columns, 3);
    assert.equal(doc.tables[0].rows, 2);
  });

  test('parses table that extends to the very end of the file', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const doc = parseMarkdown(md);
    assert.equal(doc.tables.length, 1);
    assert.equal(doc.tables[0].columns, 2);
    assert.equal(doc.tables[0].rows, 1);
  });

  test('parses lists and preserves items', () => {
    const md = `
- Item 1
- Item 2
  - Nested
1. Ordered 1
2. Ordered 2
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.listItems.length, 5);
    assert.equal(doc.listItems[0].ordered, false);
    assert.equal(doc.listItems[0].text, 'Item 1');
    assert.equal(doc.listItems[2].level, 1);
    assert.equal(doc.listItems[3].ordered, true);
  });

  test('parses inline links and autolinks', () => {
    const md = `
Check [Documentation](https://example.com/docs) and <https://example.com/autolink>.
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.links.length, 2);
    assert.equal(doc.links[0].href, 'https://example.com/docs');
    assert.equal(doc.links[0].text, 'Documentation');
    assert.equal(doc.links[1].href, 'https://example.com/autolink');
  });

  test('parses images and does not confuse them with links', () => {
    const md = `
![Banner](https://example.com/banner.png)
[Link](https://example.com/banner.png)
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.images.length, 1);
    assert.equal(doc.images[0].alt, 'Banner');
    assert.equal(doc.images[0].src, 'https://example.com/banner.png');
    assert.equal(doc.links.length, 1);
    assert.equal(doc.links[0].text, 'Link');
  });

  test('parses GitHub alert admonitions', () => {
    const md = `
> [!NOTE]
> Important context here.

> [!WARNING]
> Breaking change caution.
`;
    const doc = parseMarkdown(md);
    assert.equal(doc.admonitions.length, 2);
    assert.equal(doc.admonitions[0].type, 'NOTE');
    assert.equal(doc.admonitions[1].type, 'WARNING');
  });

  test('extracts semver version numbers', () => {
    const md = `
Released version v1.2.3 and upgraded from 1.0.0-beta.1 to 2.0.0.
`;
    const doc = parseMarkdown(md);
    const versions = doc.versions.map(v => v.version);
    assert.ok(versions.includes('1.2.3'));
    assert.ok(versions.includes('1.0.0-beta.1'));
    assert.ok(versions.includes('2.0.0'));
  });

  test('respects single and region ignore markers', () => {
    const md = `
# Main Heading

<!-- i18n-sync-ignore -->
## Ignored Single Heading

## Active Heading

<!-- i18n-sync-ignore-start -->
### Ignored Region 1
\`\`\`js
console.log("ignored code");
\`\`\`
<!-- i18n-sync-ignore-end -->

### Active Region
`;
    const doc = parseMarkdown(md);
    const activeHeadings = doc.headings.filter(h => !h.ignored);
    assert.equal(activeHeadings.length, 3);
    assert.deepEqual(activeHeadings.map(h => h.text), [
      'Main Heading',
      'Active Heading',
      'Active Region'
    ]);

    const activeCodeBlocks = doc.codeBlocks.filter(cb => !cb.ignored);
    assert.equal(activeCodeBlocks.length, 0);
  });
});
