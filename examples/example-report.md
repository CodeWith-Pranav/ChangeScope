# ChangeScope — checkout-service

1 changed functions; 9 affected functions; 5 suggested tests.

## Focused test command

```sh
python -m pytest 'tests/test_pricing.py::test_discount' 'tests/test_pricing.py::test_total' 'tests/test_pricing.py::test_invalid_discount' 'tests/test_checkout.py::test_checkout' 'tests/test_checkout.py::test_order'
```

Always run the full suite before release: python -m pytest

## Evidence

- tests/test_pricing.py::test_discount
  Path: shop/pricing.py::apply_discount → tests/test_pricing.py::test_discount
- tests/test_pricing.py::test_total
  Path: shop/pricing.py::apply_discount → shop/pricing.py::calculate_total → tests/test_pricing.py::test_total
- tests/test_pricing.py::test_invalid_discount
  Path: shop/pricing.py::apply_discount → tests/test_pricing.py::test_invalid_discount
- tests/test_checkout.py::test_checkout
  Path: shop/pricing.py::apply_discount → shop/pricing.py::calculate_total → shop/checkout.py::create_order → shop/checkout.py::checkout → tests/test_checkout.py::test_checkout
- tests/test_checkout.py::test_order
  Path: shop/pricing.py::apply_discount → shop/pricing.py::calculate_total → shop/checkout.py::create_order → tests/test_checkout.py::test_order

## Diagnostics

No diagnostics in the supported scope.

## Limits

- Static suggestions are not proof that other tests can be skipped.
- Supports explicit Python imports, direct function calls and same-class self/cls calls.
- Fixtures, runtime dispatch, monkey-patching, inheritance and decorators can hide dependencies.
- Only the uploaded files are analyzed; source is never executed.
