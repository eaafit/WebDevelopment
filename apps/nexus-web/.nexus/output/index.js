// [Nexus] Server module — generated from D:\Projects\Notarius\WebDevelopmentNew\WebDevelopment\apps\nexus-web\src\routes\+page.nx
// DO NOT EDIT — this file is auto-generated

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
  return `---

<section class="landing" data-nx="cd9008">
  <p class="landing-kicker" data-nx="cd9008">Nexus</p>
  <h1 class="landing-title" data-nx="cd9008">Start here</h1>
  <p class="landing-lead" data-nx="cd9008">
    This is the <strong data-nx="cd9008">minimal</strong> template: one presentation page, no i18n, no example blog or islands route.
    Edit <code class="landing-code" data-nx="cd9008">src/routes/+page.nx</code> and add routes under <code class="landing-code" data-nx="cd9008">src/routes/</code>.
  </p>
  <p class="landing-hint" data-nx="cd9008">
    Want i18n, demos, and blog stubs? Create a new project with <code class="landing-code" data-nx="cd9008">--template full</code>.
  </p>
  <a class="landing-btn" href="https://nexusjs.dev" target="_blank" rel="noopener noreferrer" data-nx="cd9008">Documentation</a>
</section>`;
}
