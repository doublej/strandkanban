// Wrap bare code-ish tokens (file paths, file.ext, file.ext:line) in backticks so
// markdown renders them as inline code — Zen dims those to keep prose readable.
// Must end in a real file extension — a bare `a/b` is a commit range, not a path.
const REF = /(?<![\w`/:.-])((?:[\w.-]+\/)*[\w-]+\.[a-z]{2,6})(?::\d+(?::\d+)?)?(?![\w`/-])/g;

export function markCodeRefs(md: string): string {
	// Odd segments are existing fenced/inline code — left untouched.
	return md
		.split(/(```[\s\S]*?```|`[^`]*`)/)
		.map((seg, i) => (i % 2 ? seg : seg.replace(REF, '`$&`')))
		.join('');
}
