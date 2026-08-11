import { spawn } from "child_process";
import { bdEnv, unwrapBdJson } from "$lib/bd";
import { beads } from "../beads/client";

export async function runBd(cwd: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn("bd", args, {
			cwd,
			shell: false,
			env: {
				...bdEnv(),
				BD_CWD: cwd,
			},
		});
		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => { stdout += data; });
		proc.stderr.on("data", (data) => { stderr += data; });

		// bd may have mutated the DB either way — drop the cached export before settling,
		// so whoever reacts to this promise reads fresh rows.
		proc.on("close", (code) => {
			beads(cwd).invalidate();
			if (code === 0) {
				resolve(unwrapEnvelopeText(stdout.trim()));
			} else {
				reject(new Error(stderr || `bd exited with code ${code}`));
			}
		});

		proc.on("error", (err) => {
			beads(cwd).invalidate();
			reject(err);
		});
	});
}

/** If stdout is a bd 1.0 JSON envelope, return the inner `.data` re-serialized; otherwise return as-is. */
function unwrapEnvelopeText(stdout: string): string {
	if (!stdout.startsWith('{')) return stdout;
	try {
		const inner = unwrapBdJson(stdout);
		return JSON.stringify(inner);
	} catch {
		return stdout;
	}
}
