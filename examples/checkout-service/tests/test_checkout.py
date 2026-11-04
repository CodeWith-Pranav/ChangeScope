from shop.checkout import checkout, create_order


def test_checkout():
    assert checkout([100], 10)["total"] == 90


def test_order():
    assert create_order([25, 25])["status"] == "created"
