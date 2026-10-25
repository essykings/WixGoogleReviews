// @ts-check
import { defineConfig, envField } from 'astro/config';
import wix from '@wix/astro';
import react from '@astrojs/react';
import wixHostingAdapter from '@wix/astro-wix-hosting-adapter';

export default defineConfig({
  output: 'server',
  adapter: wixHostingAdapter(),
  integrations: [wix(), react()],
  image: { domains: ['static.wixstatic.com'] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false },
  env: {
    schema: {
      // Apify API token for the review provider. Set with `wix env set` as a secret; never in the repo.
      APIFY_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      // The Supabase back office (logs and the spend brake). Both optional: without them the app simply does not log or brake.
      INSIGHTS_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      INSIGHTS_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
