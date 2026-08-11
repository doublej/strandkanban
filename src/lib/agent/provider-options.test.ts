import { describe, expect, it } from 'bun:test';
import { checkOpencodeModel } from './provider-options';

describe('checkOpencodeModel', () => {
	it('accepts empty (server default stands)', () => {
		expect(checkOpencodeModel('')).toBeNull();
		expect(checkOpencodeModel('   ')).toBeNull();
	});

	it('accepts providerID/model, with or without a variant', () => {
		expect(checkOpencodeModel('anthropic/claude-sonnet-4-5')).toBeNull();
		expect(checkOpencodeModel('anthropic/claude-sonnet-4-5#thinking')).toBeNull();
	});

	it('keeps extra slashes — openrouter ids carry their own', () => {
		expect(checkOpencodeModel('openrouter/anthropic/claude-opus-latest')).toBeNull();
	});

	it('rejects a bare model, which the server drops silently', () => {
		expect(checkOpencodeModel('sonnet')).toContain('providerID/model');
	});

	it('rejects a missing side of the slash', () => {
		expect(checkOpencodeModel('/claude-sonnet')).toContain('providerID/model');
		expect(checkOpencodeModel('anthropic/')).toContain('providerID/model');
	});
});
