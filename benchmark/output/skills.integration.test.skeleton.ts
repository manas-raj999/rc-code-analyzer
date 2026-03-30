import { describe, it, expect } from 'vitest';
import { GeminiCliAgent } from './agent.js';
import { skillDir } from './skills.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';