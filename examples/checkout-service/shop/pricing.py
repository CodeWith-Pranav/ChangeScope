def apply_discount(subtotal, percent):
    """Return the price after a percentage discount."""
    if percent < 0 or percent > 100:
        raise ValueError("Invalid discount")
    return round(subtotal * (1 - percent / 100), 2)


def calculate_total(items, discount=0):
    subtotal = sum(items)
    return apply_discount(subtotal, discount)
