# rc-code-analyzer

A `gemini-cli` extension implementing domain-specific context reduction 
mechanics for large code repositories like Rocket.Chat's monorepo.

## The Problem

Pointing an AI agent at a production monorepo reveals two compounding issues:

- **Ingestion bloat**: unscoped file discovery pulls irrelevant code into context
- **Trajectory elongation**: session history fills with stale tool outputs

Existing solutions (KV caching, llmlingua) are O(n) — they slow the problem 
without changing its shape. This project exploits structural properties of code 
to achieve reductions that compound rather than delay.

## Approach

Code has properties generic text does not:
- Fixed grammar (parseable without LLM)
- Machine-readable dependency declarations (import statements)
- Clean interface/implementation boundary (signature vs body)

These properties make it possible to strip function bodies while preserving 
everything needed for dependency analysis — a lossless-for-discovery reduction.

## Layer 1: Skeletonization (implemented)

Uses tree-sitter to parse TypeScript/JavaScript files and extract:
- All import statements (dependency graph edges)
- Function/method signatures (no bodies)
- Interface and type declarations (in full)
- Class structure (no method bodies)

### Results on gemini-cli SDK files

| File | Original | Skeleton | Reduction |
|------|----------|----------|-----------|
| *(run benchmark to populate)* | | | |

## Usage
```bash
npm install

# Skeletonize a single file
node src/skeletonize.js path/to/file.ts

# Benchmark multiple files
node benchmark/run.js path/to/file1.ts path/to/file2.ts
```

## Roadmap

- [ ] Layer 1: Skeletonization + BFS dependency traversal
- [ ] Rocket.Chat-specific: `resolve_alias` (TypeScript path aliases)
- [ ] Rocket.Chat-specific: `resolve_meteor_method` (Meteor method lookup)
- [ ] Layer 2: `BeforeModel` hook — session history compression
- [ ] Layer 3: Cross-session playbook with structured storage
- [ ] gemini-cli extension packaging (`gemini-extension.json`)

## GSoC 2026

This is a proof-of-concept for a GSoC 2026 proposal targeting 
Rocket.Chat's "Code Analyzer: agentic inference context reduction mechanics" idea.
