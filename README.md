# rc-code-analyzer

A **gemini-cli extension** that implements structural context reduction for AI agents working on large codebases — built specifically for Rocket.Chat's monorepo, designed to be upstreamed.

---

## The Problem

When you point an AI agent at a production monorepo, it doesn't fail because the model is bad. It fails because of how agentic inference loops work.

Two compounding failure modes:

**Ingestion bloat** — The agent has no structural sense of what's relevant before reading. It follows import chains exhaustively, pulling in transitive dependencies the current task never needed. In Rocket.Chat's monorepo, a single feature module can chain through `@rocket.chat/core-services` → `@rocket.chat/models` → shared types before reaching the actual logic.

**Trajectory elongation** — Even with careful ingestion, every tool call appends its full output to message history. By turn 10, the agent is still carrying raw file reads from turn 2 — observations it has already acted on and no longer needs verbatim.

Existing mitigations (KV caching, llmlingua, session compression) are O(n). They slow the accumulation but don't change its shape.

What changes the shape is exploiting properties that are **specific to code** and don't exist in generic text: fixed grammar, machine-readable dependency declarations, and a clean boundary between interface and implementation.

---

## Approach

Three layers, each targeting a distinct failure mode at a distinct integration point in the agent loop.

```
┌──────────────────────────────────────────────────────┐
│                   gemini-cli agent                   │
│                                                      │
│  MCP tool calls  ──►  Layer 1: Scope Discovery       │
│                       (skeletonization + BFS graph)  │
│                                                      │
│  BeforeModel hook ──► Layer 2: History Compression   │
│                                                      │
│  AfterAgent hook  ──► Layer 3: Cross-Session Playbook│
└──────────────────────────────────────────────────────┘
```

### Layer 1 — Scope-Limited Skeletonized Discovery

Uses `tree-sitter` to parse TypeScript/JavaScript deterministically (no LLM, no regex) and strip function bodies while preserving everything needed for dependency graph construction.

**Why tree-sitter over regex:** TypeScript decorators, conditional types, generic constraints, and type assertions produce false parse edges with regex. Wrong parse edges mean the agent follows wrong import chains.

**What the skeletonizer keeps:**
- All import statements (dependency graph edges)
- Exported function and class signatures (no bodies)
- Interface and type declarations (in full)
- Enum declarations

**What it drops:** function bodies, method implementations, test case logic, inline comments inside logic.

**MCP tools exposed:**

| Tool | Purpose |
|------|---------|
| `get_scope(entry, depth?)` | BFS-limited dependency neighborhood as skeletons |
| `read_file_skeleton(path)` | Single file skeleton |
| `read_symbol_details(symbol)` | Full source of one symbol on demand |
| `resolve_alias(import_path)` | TypeScript path alias → filesystem path |
| `resolve_meteor_method(name)` | Meteor.methods({}) registration → handler file |
| `blast_radius(symbol)` | Reverse dependency lookup |

The `resolve_alias` and `resolve_meteor_method` tools are Rocket.Chat-specific. Standard Node.js module resolution fails completely on `@rocket.chat/*` imports without reading `tsconfig.json` paths config first. `resolve_meteor_method` is required to trace any DDP call to its implementation — without it, there's no path from a method name to a handler file.

### Layer 2 — Session-Aware History Compression

Integration point: the `BeforeModel` hook, which fires synchronously before every Gemini API call and receives the full message history array.

Rolling window: last N turns kept verbatim (default: 5, configurable). Older turns become candidates for compression based on content type.

**Content-aware masking** — not all tool outputs should be treated the same:

| Output Type | Policy | Reason |
|-------------|--------|--------|
| Error outputs | Never compress | Agent needs failure signals for self-correction |
| Skeleton outputs | Safe to compress to one-line placeholder | Skeleton is freely recoverable via content hash |
| Raw file reads | Safe to drop after skeleton extracted | Information already processed |
| Model reasoning turns | Keep verbatim | Compressing these breaks reasoning continuity |

A compressed turn looks like: `[read_file: apps/meteor/app/livechat/server/lib/routing.ts — skeleton cached, 847 tokens saved]`

### Layer 3 — Cross-Session Playbook

Integration point: the `AfterAgent` hook, which fires when a session ends.

Extracts: file locations for key concepts, alias resolution results, Meteor method mappings, architectural patterns. Stored as versioned JSON (not flat markdown) to support contradiction detection between sessions as the codebase evolves.

---

## Benchmark Results (gemini-cli SDK package)

| File | Original | Skeleton | Reduction |
|------|----------|----------|-----------|
| `agent.integration.test.ts` | ~1,587 tokens | ~56 tokens | **96.5%** |
| `tool.test.ts` | ~1,125 tokens | ~55 tokens | **95.1%** |
| `skills.integration.test.ts` | ~891 tokens | ~59 tokens | **93.4%** |
| `tool.ts` | ~1,087 tokens | ~837 tokens | **23.0%** |
| `types.ts` | ~543 tokens | ~460 tokens | **15.3%** |
| **Aggregate (SDK package)** | **~8,399 tokens** | **~4,581 tokens** | **45.5%** |

Test files reduce by ~95% because their bodies carry zero value for dependency graph construction — only imports are preserved, which is correct behavior. The 15.3% on `types.ts` is also correct: that file is almost entirely interface declarations, so there's not much body to strip.

The higher reductions will come from Rocket.Chat's feature modules in `apps/meteor/app/`, which have significantly heavier method bodies than the thin SDK wrapper layer tested here.

---

## Usage

```bash
npm install

# Skeletonize a single file
node src/skeletonize.js path/to/file.ts

# Benchmark multiple files
node benchmark/run.js path/to/file1.ts path/to/file2.ts
```

---

## Status

| Layer | Status |
|-------|--------|
| Layer 1: Skeletonizer (tree-sitter) | ✅ Implemented |
| Layer 1: BFS dependency traversal | 🔄 In progress |
| Layer 1: `resolve_alias` (TS path aliases) | 🔲 Planned |
| Layer 1: `resolve_meteor_method` | 🔲 Planned |
| Layer 2: BeforeModel hook compression | 🔲 Planned |
| Layer 3: Cross-session playbook | 🔲 Planned |
| gemini-cli extension packaging | 🔲 Planned |

---

## Context

Built as a proof-of-concept for a GSoC 2026 proposal targeting Rocket.Chat's *"Code Analyzer: agentic inference context reduction mechanics"* idea by Manas Raj. The extension architecture is designed to be upstreamable to gemini-cli. 

---

## License

MIT
