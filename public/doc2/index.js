#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const marked = require('marked');
const markdownToc = require('markdown-toc');
const docs = require(path.join(__dirname, '..', '..', 'docs'));

const template = docs.getTemplate();
const src = docs.getMarkdown();
const md = marked(src);
const toc = marked(markdownToc(src).content);

const content = `\
<div class=toc>
${toc}
</div>
<div class=body>
${md}
</div>
`;
const result = template.replace('<!-- CONTENT -->', content);

fs.writeFileSync(path.join('docs.html'), result);
