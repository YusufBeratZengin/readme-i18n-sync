#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli().then(code => {
  process.exit(code);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
