import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// http://localhost is already a secure context (service workers, push, clipboard all work),
// so TLS buys nothing there and a self-signed cert costs every user a browser warning on
// every new port. Only opt in when serving a real hostname, e.g. a phone on the LAN.
const useHttps = process.env.STRAND_HTTPS === '1';

export default defineConfig({
	plugins: [sveltekit(), ...(useHttps ? [basicSsl()] : [])],
	server: {
		hmr: false,
		host: '0.0.0.0',
		allowedHosts: ['m2.local', 'strandkanban.local']
	}
});
