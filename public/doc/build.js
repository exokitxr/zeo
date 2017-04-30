#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const marked = require('marked');
const markdownToc = require('markdown-toc');
const docs = require(path.join(__dirname, '..', '..', 'docs'));

const template = docs.getTemplate();
const srcs = docs.getMarkdowns();
const md = srcs.map(({name, data}) => `\
<div class="section ${name}">
  ${marked(data)}
</div>
`).join('\n');
const toc = srcs.map(({name}) => `<a href="/docs/${name}" class="${name}">${name.slice(0, 1).toUpperCase() + name.slice(1)}</a>`).join('\n');

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
