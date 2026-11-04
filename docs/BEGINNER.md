# A beginner's guide

A project solves a real problem and gives someone a usable way to interact with the solution. Here the problem is: after editing one Python function, which other functions and tests might depend on it?

## Frontend, backend and API

The frontend runs in your browser. `public/index.html` defines structure, `styles.css` controls appearance, and `client.js` handles uploads, clicks, graph rendering and results.

The backend runs on the server. `standalone/server.mjs` receives HTTP requests, serves frontend files and passes API requests to `core/http.mjs`. The algorithm is in `core/analyzer.mjs`.

An API is a defined way for programs to communicate. The frontend sends filenames, source strings and a diff as JSON to `POST /api/analyze`. The backend returns JSON describing functions, graph edges, affected nodes, tests and warnings. The frontend turns that result into the dashboard.

There is no AI model here. A Python syntax parser and graph algorithm compute the result directly. Not every technical project needs AI. There is no database because this version does not keep accounts or project history; export files provide intentional persistence.

## Localhost, GitHub and a live site

`localhost:3000` means the server is running on your own computer. It works while the terminal process is running. Other people cannot automatically visit it.

GitHub stores source and change history. Recruiters can inspect the README, tests and implementation. It does not automatically run a Node backend. A web host runs that backend and gives visitors a public HTTPS URL. A good portfolio links both source and live demo.

## First hour

1. Run the app and inspect `apply_discount` in Code changes.
2. Follow its path through `calculate_total`, `create_order` and `checkout` to a test.
3. Open `core/sample.mjs` and confirm those functions exist.
4. Run `npm test`; read one alias test and the Git integration test.
5. Find the reverse adjacency map, queue and visited map in `analyze`.

## Your own contribution

Pick one specific improvement you can explain. Write a failing test, implement the feature, rerun the suite, then commit the change. Record the tradeoff and one limitation you did not solve. State honestly what assistance you used and what you personally changed.

This project demonstrates maps, sets, trees, adjacency lists and BFS. It does not replace practicing DSA questions. Employers can assess your reasoning about the problem, architecture, algorithm, failure cases and tests more meaningfully than a long feature list.
