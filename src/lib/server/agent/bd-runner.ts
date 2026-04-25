import { spawn } from "child_process";
import { bdEnv, unwrapBdJson } from "$lib/bd";

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

		proc.on("close", (code) => {
			if (code === 0) {
				resolve(unwrapEnvelopeText(stdout.trim()));
			} else {
				reject(new Error(stderr || `bd exited with code ${code}`));
			}
		});

		proc.on("error", reject);
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
