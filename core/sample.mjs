export const sample = {
  name: "checkout-service",
  files: [
    {
      path: "shop/pricing.py",
      content: `def apply_discount(subtotal, percent):
    """Return the price after a percentage discount."""
    if percent < 0 or percent > 100:
        raise ValueError("Invalid discount")
    return round(subtotal * (1 - percent / 100), 2)


def calculate_total(items, discount=0):
    subtotal = sum(items)
    return apply_discount(subtotal, discount)
`,
    },
    {
      path: "shop/checkout.py",
      content: `from shop.pricing import calculate_total


def create_order(items, discount=0):
    total = calculate_total(items, discount)
    return {"total": total, "status": "created"}


def checkout(items, discount=0):
    return create_order(items, discount)
`,
    },
    {
      path: "shop/catalog.py",
      content: `def available_products():
    return ["Notebook", "Pencil", "Backpack"]
`,
    },
    {
      path: "tests/test_pricing.py",
      content: `from shop.pricing import apply_discount, calculate_total


def test_discount():
    assert apply_discount(100, 10) == 90


def test_total():
    assert calculate_total([50, 50], 10) == 90


def test_invalid_discount():
    try:
        apply_discount(100, 120)
    except ValueError:
        return
    assert False
`,
    },
    {
      path: "tests/test_checkout.py",
      content: `from shop.checkout import checkout, create_order


def test_checkout():
    assert checkout([100], 10)["total"] == 90


def test_order():
    assert create_order([25, 25])["status"] == "created"
`,
    },
    {
      path: "tests/test_catalog.py",
      content: `from shop.catalog import available_products


def test_catalog():
    assert "Notebook" in available_products()
`,
    },
  ],
  diff: `diff --git a/shop/pricing.py b/shop/pricing.py
--- a/shop/pricing.py
+++ b/shop/pricing.py
@@ -1,3 +1,8 @@
 def apply_discount(subtotal, percent):
-    return subtotal - percent
+    """Return the price after a percentage discount."""
+    if percent < 0 or percent > 100:
+        raise ValueError("Invalid discount")
+    return round(subtotal * (1 - percent / 100), 2)
+
+
+def calculate_total(items, discount=0):
+    subtotal = sum(items)
+    return apply_discount(subtotal, discount)
`,
};
// A realistic edit changes the discount function only; the existing caller remains unchanged.
sample.diff = `diff --git a/shop/pricing.py b/shop/pricing.py
--- a/shop/pricing.py
+++ b/shop/pricing.py
@@ -1,5 +1,8 @@
 def apply_discount(subtotal, percent):
-    return subtotal - percent
+    """Return the price after a percentage discount."""
+    if percent < 0 or percent > 100:
+        raise ValueError("Invalid discount")
+    return round(subtotal * (1 - percent / 100), 2)
 
 
 def calculate_total(items, discount=0):
`;
