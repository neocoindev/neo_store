from store import models as store_models
from customer import models as customer_models
from plugin.currency import get_user_currency

def default(request):
    category_ = store_models.Category.objects.all()
    try:
        cart_id = request.session['cart_id']
        total_cart_items = store_models.Cart.objects.filter(cart_id=cart_id).count()
    except:
        total_cart_items = 0

    try:
        wishlist_count = customer_models.Wishlist.objects.filter(user=request.user)
    except:
        wishlist_count = 0

    # Get user currency with error handling
    try:
        user_currency = get_user_currency(request)
    except Exception:
        # Fallback to USD if currency detection fails
        user_currency = 'USD'

    return {
        "total_cart_items": total_cart_items,
        "category_": category_,
        "wishlist_count": wishlist_count,
        "user_currency": user_currency,
    }