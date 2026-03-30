/**
 * rc-code-analyzer — skeletonize.js
 *
 * Strips function bodies from TypeScript files using tree-sitter,
 * keeping only imports, signatures, interfaces, and type declarations.
 *
 * This is the core of Layer 1 context reduction.
 * A skeletonized file is ~70-85% smaller in tokens than the original,
 * while preserving all information needed for dependency graph construction.
 */

const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript').typescript;
const fs = require('fs');
const path = require('path');

const parser = new Parser();
parser.setLanguage(TypeScript);

function skeletonize(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const tree = parser.parse(source);
  const lines = source.split('\n');
  const keepLines = new Set();

  function visit(node) {
    switch (node.type) {

      // Always keep imports — they define the dependency graph
      case 'import_statement':
        for (let i = node.startPosition.row; i <= node.endPosition.row; i++)
          keepLines.add(i);
        break;

      // Keep function/class/method signatures but strip bodies
      case 'export_statement':
      case 'function_declaration':
      case 'method_definition':
      case 'class_declaration': {
        const bodyChild = node.children.find(c =>
          c.type === 'statement_block' || c.type === 'class_body'
        );
        const endRow = bodyChild
          ? bodyChild.startPosition.row
          : node.endPosition.row;
        for (let i = node.startPosition.row; i <= endRow; i++)
          keepLines.add(i);
        // Recurse into class bodies to catch method signatures
        if (bodyChild) visit(bodyChild);
        break;
      }

      // Always keep type-level declarations in full
      case 'interface_declaration':
      case 'type_alias_declaration':
      case 'enum_declaration':
      case 'ambient_declaration':
        for (let i = node.startPosition.row; i <= node.endPosition.row; i++)
          keepLines.add(i);
        break;

      default:
        for (const child of node.children) visit(child);
    }
  }

  visit(tree.rootNode);

  const skeleton = lines
    .filter((_, idx) => keepLines.has(idx))
    .join('\n');

  // Token estimate: TypeScript averages ~3.5 chars per token
  // due to long identifiers and type annotations
  const origTokens = Math.round(source.length / 3.5);
  const skelTokens  = Math.round(skeleton.length / 3.5);

  return {
    skeleton,
    originalLines: lines.length,
    skeletonLines: skeleton.split('\n').length,
    origTokens,
    skelTokens,
    reductionPct: ((1 - skelTokens / origTokens) * 100).toFixed(1)
  };
}

module.exports = { skeletonize };

// --- CLI entry point ---
if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node src/skeletonize.js <path-to-.ts-file>');
    process.exit(1);
  }

  const r = skeletonize(path.resolve(target));

  console.log('\n========== SKELETON OUTPUT ==========\n');
  console.log(r.skeleton);
  console.log('\n========== REDUCTION STATS ==========');
  console.log(`Original : ${r.originalLines} lines  (~${r.origTokens} tokens)`);
  console.log(`Skeleton : ${r.skeletonLines} lines  (~${r.skelTokens} tokens)`);
  console.log(`Reduction: ${r.reductionPct}%`);
  console.log('=====================================\n');
}
