#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli().then(code => {
  process.exit(code);
}).catch(err => {
  console.error(`Error: ${err.message.replace(/[\r\n]+/g, ' ')}`);
  process.exit(2);
});
