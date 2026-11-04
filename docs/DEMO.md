# A three-minute demo

1. Open the app and describe the problem: finding callers/tests potentially affected by a Python edit.
2. In Code changes, show `apply_discount`: the example replaces flat subtraction with percentage calculation and input validation.
3. Follow the impact path: apply_discount → calculate_total → create_order → checkout → test_checkout.
4. Show five suggested tests; explain why the unrelated catalog test is absent from the supported graph.
5. Inspect source, copy a command and export a report.
6. Explain that static reachability is not proof that other tests are safe to skip.
7. Open the reverse BFS implementation and one edge-case test.

Upload `examples/checkout-service` with `examples/change.diff` to reproduce the example manually. For a real project, choose a small repository with matching current source and diff. Do not upload confidential code to a public demo.

If Python and pytest are installed, you can enter `examples/checkout-service` and run `python -m pytest`. That is separate from ChangeScope's analysis.

Before sending recruiter links, check the demo and GitHub README from a normal browser. Include a change you personally made and understand. Do not claim measured accuracy, test coverage or speedups without a real evaluation dataset.
