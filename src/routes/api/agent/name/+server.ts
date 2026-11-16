import type { RequestHandler } from './$types';
import { query, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { log } from '$lib/server/logger';
import { ok, wrap, ApiError } from '$lib/server/response';

const PROMPT = `Name a coding agent for "strandkanban" (task tracker with bead/string theme).

Pick ONE random vibe and invent a funny name:
- BEAD PUNS: "bead" = "be/beat" wordplay
- GEM JOKES: geology/gemstone humor
- STRING THEORY: thread/knot/weave puns
- SEA VIBES: pearl/shell/ocean creatures
- CODER CHAOS: bugs/caffeine/git jokes
- POP CULTURE: movies/memes + coding
- FOOD MASHUPS: snacks + programming
- ANIMAL CODERS: creatures + tech

STRICT RULES:
- Exactly 2 words, hyphenated, lowercase (e.g. "clam-debugger")
- Be creative - invent new combos
- Dad-joke energy preferred

Output the name only. No explanation. No alternatives.`;

/** One-shot prompt: the SDK's final `result` message carries the reply text. */
async function promptOnce(prompt: string, model: string): Promise<SDKResultMessage | undefined> {
	for await (const msg of query({ prompt, options: { model, maxTurns: 1 } })) {
		if (msg.type === 'result') return msg;
	}
}

export const POST: RequestHandler = wrap(async () => {
	try {
		const result = await promptOnce(PROMPT, 'claude-haiku-4-5-20251001');

		if (result?.subtype !== 'success' || !result.result) {
			throw new ApiError('Failed to generate name', 500);
		}

		const name = result.result.trim().toLowerCase().replace(/\s+/g, '-');
		return ok({ name });
	} catch (error) {
		log.error('[agent/name] Error generating name:', error);
		throw new ApiError('Failed to generate name', 500);
	}
});
