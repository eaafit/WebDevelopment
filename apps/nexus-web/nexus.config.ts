import type { NexusConfig } from '@nexus_js/cli';

export default {
  defaultHydration: 'client:visible',

  images: {
    formats: ['avif', 'webp'],
    sizes: [640, 1280, 1920],
  },

  server: {
    port: 3000,
  },

  build: {
    outDir: '.nexus/output',
    sourcemap: false,
  },
} satisfies NexusConfig;
