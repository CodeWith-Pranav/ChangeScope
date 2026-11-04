from shop.pricing import calculate_total


def create_order(items, discount=0):
    total = calculate_total(items, discount)
    return {"total": total, "status": "created"}


def checkout(items, discount=0):
    return create_order(items, discount)
