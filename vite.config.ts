import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), basicSsl()],
	server: {
		hmr: false,
		host: '0.0.0.0',
		allowedHosts: ['m2.local', 'strandkanban.local']
	}
});
