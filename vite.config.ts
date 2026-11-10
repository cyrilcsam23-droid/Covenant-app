import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Content-Security-Policy for built versions (GitHub Pages can't send headers, so it
 * goes in a <meta> tag). The app may only run its own scripts and only talk to its own
 * Supabase project. Left out of `npm run dev`, which needs inline scripts for hot reload.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  let api = '';
  if (supabaseUrl) {
    const { host } = new URL(supabaseUrl);
    api = ` https://${host} wss://${host}`;
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // motion sets inline style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${api}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'covenant-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
    server: { port: 5180, host: true },
  };
});
