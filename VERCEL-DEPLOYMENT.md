# Vercel deployment

Production: https://changescope-psi.vercel.app

Deployed to the connected Vercel account on 2026-11-04. Vercel detected the supplied Dockerfile and deployed the standalone Node server using its container framework. The existing frontend and analysis engine are preserved. The api/index.mjs adapter and vercel.json rewrite are also supplied for serverless deployment; the verified production deployment uses the existing container server.

Run `npm ci` and `npm test` to verify the source. All 24 tests passed. No database or secret is required.
