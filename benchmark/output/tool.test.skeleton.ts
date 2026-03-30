import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SdkTool, tool, ModelVisibleError } from './tool.js';
import type { MessageBus } from '@google/gemini-cli-core';