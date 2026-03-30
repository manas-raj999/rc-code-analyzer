import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiCliAgent } from './agent.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';