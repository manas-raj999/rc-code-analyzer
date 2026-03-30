/**
 * Benchmark runner — measures token reduction across multiple files.
 * Run against real Rocket.Chat source files to get proposal numbers.
 */

const { skeletonize } = require('../src/skeletonize');
const fs = require('fs');
const path = require('path');

const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error('Usage: node benchmark/run.js <file1.ts> <file2.ts> ...');
  process.exit(1);
}

let totalOrigTokens = 0;
let totalSkelTokens = 0;

console.log('\n======== BENCHMARK RESULTS ========\n');

for (const target of targets) {
  try {
    const r = skeletonize(path.resolve(target));
    totalOrigTokens += r.origTokens;
    totalSkelTokens += r.skelTokens;

    const shortName = path.basename(target);
    console.log(`File    : ${shortName}`);
    console.log(`Before  : ${r.originalLines} lines (~${r.origTokens} tokens)`);
    console.log(`After   : ${r.skeletonLines} lines (~${r.skelTokens} tokens)`);
    console.log(`Saved   : ${r.reductionPct}%`);
    console.log('-----------------------------------');

    // Save skeleton to benchmark/output/
    const outDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const outFile = path.join(outDir, shortName.replace('.ts', '.skeleton.ts'));
    fs.writeFileSync(outFile, r.skeleton);
    console.log(`Saved to: benchmark/output/${path.basename(outFile)}\n`);

  } catch (err) {
    console.error(`ERROR on ${target}: ${err.message}\n`);
  }
}

const overall = ((1 - totalSkelTokens / totalOrigTokens) * 100).toFixed(1);
console.log('======== AGGREGATE ================');
console.log(`Total original tokens : ~${totalOrigTokens}`);
console.log(`Total skeleton tokens : ~${totalSkelTokens}`);
console.log(`Overall reduction     : ${overall}%`);
console.log('====================================\n');
