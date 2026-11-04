from shop.pricing import apply_discount, calculate_total


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
