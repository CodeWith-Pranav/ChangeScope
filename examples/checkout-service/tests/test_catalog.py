from shop.catalog import available_products


def test_catalog():
    assert "Notebook" in available_products()
