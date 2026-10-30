# Runtime recovery, 30 October 2026

Production repair applied at 10:59:58 America/Sao_Paulo, after isolated real-browser fail/pass proof.

## Cause and repair

Renaming only the Vite entry duplicated React: lazy chunks still imported index-CXBEgGhA.js, while HTML loaded another full entry. The same application serves the website, customer portal and CRM.

The corrected complete entry is now assets/index-CXBEgGhA.js. The former names index-menu-20261030.js and index-title-20261030.js contain only the re-export in entry-alias.js. HTML references the original name. The aliases preserve compatibility with cached HTML. Revalidation headers cover HTML and these three entry filenames. No backend, database or login files changed.

Deployed SHA256:
- index.html: ad5972ab740dcea48e2e5a42b107317adccfe949782b4f85ce3ae12f7e219ee8
- assets/index-CXBEgGhA.js: 46b87b54841befc63ef500b89489d16793faffdef90dff4f31660b03280473b2
- both entry aliases: dbc4e2b7f6a3bea7919fd7dda343dba8182ccd4876b3655c58c9480d54efb1d1

Backup on hosting: ~/wm-home-backups/runtime-20261030. Earlier original backup: ~/wm-home-backups/title-20261030. The included recovery script is a historical record, not a routine deployment command; do not rerun it, which would overwrite the incident backup.

## Required release gate

1. Build and publish a complete, coherent Vite output graph. Never rename or replace an entry in isolation while lazy imports point at another full runtime.
2. Keep previous assets for cached HTML. Compatibility aliases must re-export the same canonical module, not duplicate its contents. Test actual browser behavior, including old HTML, before publication.
3. Before touching production, reproduce the reported failure and prove the proposed repair with real mirrored assets and a real browser. Block external backend requests during isolated UI tests.
4. Test menu clicks and async rendered results, not URL changes alone. Include home, Consultar, Blog, customer login, admin login and proposal form, desktop and mobile, console and failed network requests. Do not submit customer data or payment forms for a navigation test.
5. Back up first, publish reversibly, verify exact public content/hashes, purge CDN through normal UI, then retest. Stop on throttling or challenges; do not treat their error pages as passing routes.
6. Inspect screenshots after transitions/animations settle. Verify requested anchor scroll positions and title/seal separation.

## Validation scope and limits

Isolated browser before: ErrorBoundary on mobile menu to Consultar. After: same topology with canonical runtime and aliases passes Consultar, Blog, customer login, admin dashboard redirect and form.

Production cloud-browser checks: all eight mobile menu destinations, target sections after smooth scroll, Consultar desktop/mobile, Blog, customer login, admin login and proposal form rendered. No form submitted. Title black Arial/Helvetica 700 at 27px mobile and 26px desktop; seal does not cover title at tested 390px and desktop. 320px header/social-proof limitations were not fully cleared.

No authenticated CRM data audit or database integrity/count guarantee. Back/forward not validated. One public-browser attempt saw CSS preload failure; exact CSS later returned 200 text/css with identical host hash. Subsequent local-browser 403/429 responses stopped that test path; no claim of universal availability.

Temporary SSH key removed and verified absent at 11:10:36. No persistent extra access retained.
