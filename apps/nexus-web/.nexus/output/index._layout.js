// [Nexus] Server module — generated from D:\Projects\Notarius\WebDevelopmentNew\WebDevelopment\apps\nexus-web\src\routes\+layout.nx
// DO NOT EDIT — this file is auto-generated

// ── Imports & server-only (leading + // nexus:server) ──
const appName = 'My Nexus App';

export async function render(ctx) {
  const __html = await renderTemplate(ctx);
  return {
    html: __html,
    css: true,
    hasIslands: false,
  };
}

async function renderTemplate(ctx) {
  // Primary context from nxPretext (layouts + page, parallel merge) — mirrors client $pretext()
  const pretext = ctx.pretext ?? {};
  const $pretext = () => ctx.pretext ?? {};
  // Server-side template rendering (CSS-scoped at compile time)
  const __ssrAttr = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  return `<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Built with Nexus — add your own copy in +layout.nx.">
    <title data-nx="77ce32">${appName}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="nx-body">
    <div class="nx-bg" aria-hidden="true" data-nx="77ce32"></div>
    <header class="nx-header" data-nx="77ce32">
      <a class="nx-brand" href="/" data-nx="77ce32">
        <span class="nx-brand-mark" aria-hidden="true" data-nx="77ce32">◆</span>
        <span data-nx="77ce32">${appName}</span>
      </a>
      <nav class="nx-nav" aria-label="Main" data-nx="77ce32">
        <a href="https://nexusjs.dev" target="_blank" rel="noopener noreferrer" data-nx="77ce32">Docs</a>
      </nav>
    </header>
    <main class="nx-main" data-nx="77ce32">
      <!--nexus:slot-->
    </main>
    <footer class="nx-footer" data-nx="77ce32">
      <p data-nx="77ce32">Built with <a href="https://nexusjs.dev" target="_blank" rel="noopener noreferrer" data-nx="77ce32">Nexus</a></p>
    </footer>
  </body>
</html>`;
}
