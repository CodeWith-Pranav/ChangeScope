# GitHub and deployment

## GitHub source repository and Vercel

Repository: https://github.com/CodeWith-Pranav/ChangeScope
Production: https://changescope-psi.vercel.app

The existing Vercel project is connected to this repository. Pushes to main trigger production deployments. Pull requests receive previews, and GitHub Actions runs the tests.

```sh
git clone https://github.com/CodeWith-Pranav/ChangeScope.git
cd ChangeScope
npm ci
npm test
npm start
```

After editing, review your diff, run the tests and commit your changes:

```sh
git diff
npm test
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

Never commit credentials, node_modules, or private source reports. Original source and deployment migration are separate commits; earlier development history was not fabricated. See [../VERCEL-DEPLOYMENT.md](../VERCEL-DEPLOYMENT.md) for the deployed runtime. Render and Docker below are alternative hosting instructions.

## Render

Connect your GitHub repository and create a Blueprint using `render.yaml`, or configure a Node web service:

- Build: `npm ci --ignore-scripts && npm test`
- Start: `npm start`
- Health check: `/api/health`
- Node 22; HOST=0.0.0.0; TRUST_PROXY=1

The Blueprint requests `plan: free`. Confirm current eligibility and terms in your provider account; the source package does not authorize paid resources. The host assigns the actual public address. Do not invent an address from the service name. Custom domains need a domain you control and DNS configuration.

The app has no ChatGPT branding, login or runtime dependency. Publishing to another host requires that connected account and a repository/upload route. GitHub Pages alone cannot run the Node backend.

Official configuration reference checked during preparation: https://render.com/docs/blueprint-spec

## Docker

```sh
docker build -t changescope .
docker run --rm -p 3000:3000 changescope
```

Visit http://localhost:3000. The image runs as a non-root user. Docker must be installed; the supplied configuration is not a claim that a container was executed during delivery.

## Environment

PORT defaults to 3000 and HOST to 127.0.0.1. `.env.example` is documentation; it is not automatically loaded. You can copy it to `.env` and run `node --env-file=.env standalone/server.mjs` with supported Node versions.

Enable TRUST_PROXY=1 only behind a trusted proxy that overwrites X-Forwarded-Proto. This supports HTTPS same-origin checks when TLS terminates at the proxy. The server does not trust forwarded-host headers. Keep it disabled for direct local use.

## Troubleshooting

Missing npm: install Node and reopen your terminal. Port in use: stop the old process or change PORT. Diff mismatch: regenerate diff and upload the matching current source/root. No suggestions: inspect diagnostics/test naming/missing files. Cross-origin error: use the frontend served by the same backend and configure proxy handling correctly. Large repository: choose a coherent smaller package and acknowledge partial coverage.

Before broad public use, add provider-level rate limiting and monitoring. This release has no accounts or saved project storage.
