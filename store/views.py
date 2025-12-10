from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
from django.db import models
from django.db.models import Q, F, Min, Max, Count
from django.conf import settings
from django.urls import reverse
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives, send_mail

from decimal import Decimal
import requests
import stripe
from plugin.service_fee import calculate_service_fee
import razorpay

from plugin.paginate_queryset import paginate_queryset
from store import models as store_models
from customer import models as customer_models
from vendor import models as vendor_models
from userauths import models as userauths_models
from plugin.tax_calculation import tax_calculation
from plugin.exchange_rate import convert_usd_to_inr, convert_usd_to_kobo, convert_usd_to_ngn, get_usd_to_ngn_rate


# stripe.api_key = settings.STRIPE_SECRET_KEY
# razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

def clear_cart_items(request):
    try:
        cart_id = request.session['cart_id']
        store_models.Cart.objects.filter(cart_id=cart_id).delete()
    except:
        pass
    return

def index(request):
    products = store_models.Product.objects.filter(status="Published")
    categories = store_models.Category.objects.all()
    main_banners = store_models.Banner.objects.filter(banner_type="main", status="Published").order_by('order', '-date')
    small_banners = store_models.Banner.objects.filter(banner_type="small", status="Published").order_by('order', '-date')[:3]
    
    context = {
        "products": products,
        "categories": categories,
        "main_banners": main_banners,
        "small_banners": small_banners,
    }
    return render(request, "store/index.html", context)

def shop(request):
    from decimal import Decimal
    from django.db.models import Avg
    
    # Начинаем с базового queryset только опубликованных товаров
    products_list = store_models.Product.objects.filter(status="Published").select_related('category', 'vendor').prefetch_related('reviews', 'product_variants')
    
    # ========== ПРИМЕНЕНИЕ ФИЛЬТРОВ ИЗ GET ПАРАМЕТРОВ ==========
    
    # Поиск
    query = request.GET.get("q") or request.GET.get("searchFilter")
    if query:
        products_list = products_list.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(brand__icontains=query) |
            Q(category__title__icontains=query)
        )
    
    # Фильтр по категориям
    categories_filter = request.GET.getlist('categories[]') or request.GET.getlist('categories')
    if categories_filter:
        try:
            category_ids = [int(cat_id) for cat_id in categories_filter if cat_id and str(cat_id).isdigit()]
            if category_ids:
                products_list = products_list.filter(category__id__in=category_ids)
        except (ValueError, TypeError):
            pass
    
    # Фильтр по рейтингу
    rating_filter = request.GET.getlist('rating[]') or request.GET.getlist('rating')
    if rating_filter:
        rating_values = [int(r) for r in rating_filter if r.isdigit()]
        if rating_values:
            rating_conditions = Q()
            for r_val in rating_values:
                rating_conditions |= Q(reviews__rating__gte=r_val)
            products_list = products_list.filter(rating_conditions).distinct()
    
    # Фильтр по размерам
    sizes_filter = request.GET.getlist('sizes[]') or request.GET.getlist('sizes')
    if sizes_filter:
        size_filter = Q()
        size_filter |= Q(product_variants__size__in=sizes_filter, product_variants__is_available=True)
        products_list = products_list.filter(size_filter).distinct()
    
    # Фильтр по цветам
    colors_filter = request.GET.getlist('colors[]') or request.GET.getlist('colors')
    if colors_filter:
        color_filter = Q()
        color_filter |= Q(product_variants__color__in=colors_filter, product_variants__is_available=True)
        products_list = products_list.filter(color_filter).distinct()
    
    # Фильтр по брендам
    brands_filter = request.GET.getlist('brands[]') or request.GET.getlist('brands')
    if brands_filter:
        products_list = products_list.filter(brand__in=brands_filter).distinct()
    
    # Фильтр по наличию
    in_stock = request.GET.get('in_stock')
    if in_stock == 'true':
        products_list = products_list.filter(in_stock=True)
    elif in_stock == 'false':
        products_list = products_list.filter(in_stock=False)
    
    # Фильтр по новинкам
    is_new = request.GET.get('is_new')
    if is_new == 'true':
        products_list = products_list.filter(is_new=True)
    
    # Фильтр по скидкам
    has_discount = request.GET.get('has_discount')
    if has_discount == 'true':
        products_list = products_list.filter(regular_price__gt=F('price'))
    
    # Фильтр по диапазону цен
    min_price = request.GET.get('min_price')
    if min_price:
        try:
            min_price_decimal = Decimal(min_price)
            products_list = products_list.filter(price__gte=min_price_decimal)
        except (ValueError, TypeError):
            pass
    
    max_price = request.GET.get('max_price')
    if max_price:
        try:
            max_price_decimal = Decimal(max_price)
            products_list = products_list.filter(price__lte=max_price_decimal)
        except (ValueError, TypeError):
            pass
    
    # Сортировка
    price_order = request.GET.get('prices')
    if price_order == 'lowest':
        products_list = products_list.order_by('-price')
    elif price_order == 'highest':
        products_list = products_list.order_by('price')
    elif price_order == 'rating':
        products_list = products_list.annotate(avg_rating=Avg('reviews__rating')).order_by('-avg_rating', '-date')
    elif price_order == 'popular':
        products_list = products_list.annotate(review_count=Count('reviews')).order_by('-review_count', '-date')
    else:
        products_list = products_list.order_by('-date', '-id')
    
    # ========== ПОДГОТОВКА ДАННЫХ ДЛЯ ШАБЛОНА ==========
    
    # Получаем категории с количеством товаров (с учетом текущих фильтров)
    categories = store_models.Category.objects.annotate(
        product_count=Count('product', filter=Q(product__status='Published'))
    ).order_by('title')
    
    # Получаем цвета из Variant и ProductVariant
    colors_variant = store_models.VariantItem.objects.filter(
        variant__name='Color'
    ).values('title', 'content').distinct()
    
    colors_pv = store_models.ProductVariant.objects.filter(
        is_available=True, color__isnull=False
    ).exclude(color='').values('color', 'color_code').distinct()
    
    # Объединяем цвета
    colors_dict = {}
    for color in colors_variant:
        color_name = color['content'] or color['title']
        if color_name:
            colors_dict[color_name] = {
                'title': color['title'] or color_name,
                'content': color_name,
                'code': None
            }
    
    for color in colors_pv:
        color_name = color['color']
        if color_name and color_name not in colors_dict:
            colors_dict[color_name] = {
                'title': color_name,
                'content': color_name,
                'code': color.get('color_code')
            }
    
    colors = list(colors_dict.values())
    
    # Получаем размеры из Variant и ProductVariant
    sizes_variant = store_models.VariantItem.objects.filter(
        variant__name='Size'
    ).values('title', 'content').distinct()
    
    sizes_pv = store_models.ProductVariant.objects.filter(
        is_available=True, size__isnull=False
    ).exclude(size='').values('size').distinct()
    
    # Объединяем размеры
    sizes_dict = {}
    for size in sizes_variant:
        size_name = size['content'] or size['title']
        if size_name:
            sizes_dict[size_name] = {
                'title': size['title'] or size_name,
                'content': size_name
            }
    
    for size in sizes_pv:
        size_name = size['size']
        if size_name and size_name not in sizes_dict:
            sizes_dict[size_name] = {
                'title': size_name,
                'content': size_name
            }
    
    sizes = list(sizes_dict.values())
    
    # Получаем бренды
    brands = store_models.Product.objects.filter(
        status="Published"
    ).exclude(brand__isnull=True).exclude(brand='').values('brand').annotate(
        count=Count('id')
    ).order_by('brand')
    
    # Диапазон цен (из всех товаров, не отфильтрованных)
    all_products = store_models.Product.objects.filter(status="Published")
    price_range = all_products.aggregate(
        min_price=Min('price'),
        max_price=Max('price')
    )
    
    item_display = [
        {"id": "1", "value": 1},
        {"id": "2", "value": 2},
        {"id": "3", "value": 3},
        {"id": "40", "value": 40},
        {"id": "50", "value": 50},
        {"id": "100", "value": 100},
    ]

    ratings = [
        {"id": "1", "value": "★☆☆☆☆"},
        {"id": "2", "value": "★★☆☆☆"},
        {"id": "3", "value": "★★★☆☆"},
        {"id": "4", "value": "★★★★☆"},
        {"id": "5", "value": "★★★★★"},
    ]

    prices = [
        {"id": "lowest", "value": "От высокой к низкой"},
        {"id": "highest", "value": "От низкой к высокой"},
    ]

    # Применяем пагинацию
    products = paginate_queryset(request, products_list, 10)
    
    # Получаем текущие выбранные фильтры для восстановления состояния в шаблоне
    selected_categories = request.GET.getlist('categories[]') or request.GET.getlist('categories')
    selected_rating = request.GET.getlist('rating[]') or request.GET.getlist('rating')
    selected_sizes = request.GET.getlist('sizes[]') or request.GET.getlist('sizes')
    selected_colors = request.GET.getlist('colors[]') or request.GET.getlist('colors')
    selected_brands = request.GET.getlist('brands[]') or request.GET.getlist('brands')
    selected_prices = request.GET.get('prices', '')

    context = {
        "products": products,
        "products_list": products_list,
        "categories": categories,
        'colors': colors,
        'sizes': sizes,
        'brands': brands,
        'price_range': price_range,
        'item_display': item_display,
        'ratings': ratings,
        'prices': prices,
        # Передаем выбранные фильтры для восстановления состояния
        'selected_categories': [str(c) for c in selected_categories],
        'selected_rating': [str(r) for r in selected_rating],
        'selected_sizes': selected_sizes,
        'selected_colors': selected_colors,
        'selected_brands': selected_brands,
        'selected_prices': selected_prices,
    }
    return render(request, "store/shop.html", context)

def category(request, id):
    """
    Страница категории с фильтрацией в стиле Wildberries
    Полностью переписанная логика с корректной обработкой всех фильтров
    """
    from store.utils import build_product_filters, get_filter_options
    from plugin.paginate_queryset import paginate_queryset as paginate_qs
    
    # Получаем категорию
    try:
        category = store_models.Category.objects.get(id=id)
    except store_models.Category.DoesNotExist:
        messages.error(request, "Категория не найдена")
        return redirect('store:index')
    
    # Базовый queryset - только опубликованные товары (оптимизированный)
    base_queryset = store_models.Product.objects.filter(
        status="Published"
    ).select_related('category', 'vendor').prefetch_related(
        'reviews', 
        'product_variants'
    )
    
    # Получаем опции для фильтров ДО применения фильтров (чтобы показать все доступные опции)
    filter_options = get_filter_options(base_queryset, category=category)
    
    # Применяем фильтры
    products_list, selected_filters = build_product_filters(request, base_queryset, category=category)
    
    # Пагинация
    products = paginate_qs(request, products_list, 12)
    
    # Получаем текущие GET параметры для сохранения состояния
    current_params = request.GET.copy()
    
    # Подготавливаем данные для отображения выбранных фильтров (теги)
    from store.utils import build_active_filters
    active_filters = build_active_filters(request, selected_filters, category.id)
    
    # Сортировка
    sort_options = [
        {'value': 'popularity', 'label': 'Популярность'},
        {'value': 'price_asc', 'label': 'Сначала дешевые'},
        {'value': 'price_desc', 'label': 'Сначала дорогие'},
        {'value': 'rating', 'label': 'По рейтингу'},
    ]
    
    context = {
        "products": products,
        "products_list": products_list,
        "category": category,
        "filter_options": filter_options,
        "selected_filters": selected_filters,
        "active_filters": active_filters,
        "current_params": current_params,
        "sort_options": sort_options,
        "current_sort": selected_filters.get('sort', 'popularity'),
    }
    return render(request, "store/category.html", context)


@csrf_exempt
def category_filter_ajax(request, id):
    """
    AJAX endpoint для фильтрации товаров категории без перезагрузки страницы
    """
    import logging
    logger = logging.getLogger(__name__)
    
    from store.utils import build_product_filters, get_filter_options
    from plugin.paginate_queryset import paginate_queryset as paginate_qs
    from django.template.loader import render_to_string
    
    logger.info(f'AJAX filter request for category {id}, GET params: {dict(request.GET)}')
    
    # Получаем категорию
    try:
        category = store_models.Category.objects.get(id=id)
    except store_models.Category.DoesNotExist:
        logger.error(f'Category {id} not found')
        return JsonResponse({'success': False, 'error': 'Категория не найдена'}, status=404)
    
    # Базовый queryset - только опубликованные товары (оптимизированный)
    base_queryset = store_models.Product.objects.filter(
        status="Published"
    ).select_related('category', 'vendor').prefetch_related(
        'reviews', 
        'product_variants'
    )
    
    # Применяем фильтры
    products_list, selected_filters = build_product_filters(request, base_queryset, category=category)
    
    # Пагинация
    products = paginate_qs(request, products_list, 12)
    
    # Рендерим HTML для товаров
    products_html = render_to_string('partials/_category_products.html', {
        'products': products,
        'category': category,
    }, request=request)
    
    # Рендерим HTML для тегов фильтров
    from store.utils import build_active_filters
    active_filters = build_active_filters(request, selected_filters, category.id)
    
    # Рендерим HTML для тегов фильтров
    filters_html = ''
    if active_filters:
        filters_html = render_to_string('partials/_category_filters_tags.html', {
            'active_filters': active_filters,
            'category': category,
            'current_params': request.GET.copy(),
        }, request=request)
    
    # Рендерим HTML для пагинации
    pagination_html = ''
    if products.has_other_pages():
        pagination_html = render_to_string('partials/_category_pagination.html', {
            'products': products,
            'current_params': request.GET.copy(),
        }, request=request)
    
    # Формируем URL для обновления истории браузера
    params = request.GET.copy()
    if 'page' in params:
        params.pop('page')
    url_params = params.urlencode()
    update_url = f"/category/{id}/"
    if url_params:
        update_url += f"?{url_params}"
    
    response_data = {
        'success': True,
        'products_html': products_html,
        'filters_html': filters_html,
        'pagination_html': pagination_html,
        'product_count': products_list.count(),
        'update_url': update_url,
        'page': products.number if hasattr(products, 'number') else 1,
        'has_next': products.has_next() if hasattr(products, 'has_next') else False,
        'has_previous': products.has_previous() if hasattr(products, 'has_previous') else False,
    }
    
    # Логирование для отладки
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f'AJAX filter response: {products_list.count()} products found for category {id}')
    
    return JsonResponse(response_data)

def vendors(request):
    vendors = userauths_models.Profile.objects.filter(user_type="Vendor")
    
    context = {
        "vendors": vendors
    }
    return render(request, "store/vendors.html", context)

def product_detail(request, slug):
    product = store_models.Product.objects.get(status="Published", slug=slug)
    product_stock_range = range(1, product.stock + 1)

    related_products = store_models.Product.objects.filter(category=product.category).exclude(id=product.id)

    context = {
        "product": product,
        "product_stock_range": product_stock_range,
        "related_products": related_products,
    }
    return render(request, "store/product_detail.html", context)

def add_to_cart(request):
    # Get parameters from the request (ID, color, size, quantity, cart_id)
    id = request.GET.get("id")
    qty = request.GET.get("qty")
    color = request.GET.get("color")
    size = request.GET.get("size")
    cart_id = request.GET.get("cart_id")
    
    request.session['cart_id'] = cart_id

    # Validate required fields
    if not id or not qty or not cart_id:
        return JsonResponse({"error": "Не выбраны цвет или размер"}, status=400)

    # Try to fetch the product, return an error if it doesn't exist
    try:
        product = store_models.Product.objects.get(status="Published", id=id)
    except store_models.Product.DoesNotExist:
        return JsonResponse({"error": "Товар не найден"}, status=404)

    # Check if the item is already in the cart
    existing_cart_item = store_models.Cart.objects.filter(cart_id=cart_id, product=product).first()

    # Check if quantity that user is adding exceed item stock qty
    if int(qty) > product.stock:
        return JsonResponse({"error": "Количество превышает доступный остаток"}, status=404)

    # If the item is not in the cart, create a new cart entry
    if not existing_cart_item:
        cart = store_models.Cart()
        cart.product = product
        cart.qty = qty
        cart.price = product.price
        cart.color = color
        cart.size = size
        cart.sub_total = Decimal(product.price) * Decimal(qty)
        cart.shipping = Decimal(product.shipping) * Decimal(qty)
        cart.total = cart.sub_total + cart.shipping
        cart.user = request.user if request.user.is_authenticated else None
        cart.cart_id = cart_id
        cart.save()

        message = "Товар добавлен в корзину"
    else:
        # If the item exists in the cart, update the existing entry
        existing_cart_item.color = color
        existing_cart_item.size = size
        existing_cart_item.qty = qty
        existing_cart_item.price = product.price
        existing_cart_item.sub_total = Decimal(product.price) * Decimal(qty)
        existing_cart_item.shipping = Decimal(product.shipping) * Decimal(qty)
        existing_cart_item.total = existing_cart_item.sub_total +  existing_cart_item.shipping
        existing_cart_item.user = request.user if request.user.is_authenticated else None
        existing_cart_item.cart_id = cart_id
        existing_cart_item.save()

        message = "Корзина обновлена"

    # Count the total number of items in the cart
    total_cart_items = store_models.Cart.objects.filter(cart_id=cart_id)
    cart_sub_total = store_models.Cart.objects.filter(cart_id=cart_id).aggregate(sub_total = models.Sum("sub_total"))['sub_total']

    # Return the response with the cart update message and total cart items
    return JsonResponse({
        "message": message ,
        "total_cart_items": total_cart_items.count(),
        "cart_sub_total": "{:,.2f}".format(cart_sub_total),
        "item_sub_total": "{:,.2f}".format(existing_cart_item.sub_total) if existing_cart_item else "{:,.2f}".format(cart.sub_total) 
    })

def cart(request):
    if "cart_id" in request.session:
        cart_id = request.session['cart_id']
    else:
        cart_id = None

    items = store_models.Cart.objects.filter(cart_id=cart_id)
    cart_sub_total = store_models.Cart.objects.filter(cart_id=cart_id).aggregate(sub_total = models.Sum("sub_total"))['sub_total']
    
    try:
        addresses = customer_models.Address.objects.filter(user=request.user)
    except:
        addresses = None

    if not items:
        messages.warning(request, "В корзине нет товаров")
        return redirect("store:index")

    context = {
        "items": items,
        "cart_sub_total": cart_sub_total,
        "addresses": addresses,
    }
    return render(request, "store/cart.html", context)

def delete_cart_item(request):
    id = request.GET.get("id")
    item_id = request.GET.get("item_id")
    cart_id = request.GET.get("cart_id")
    
    # Validate required fields
    if not id and not item_id and not cart_id:
        return JsonResponse({"error": "Товар или ID товара не найдены"}, status=400)

    try:
        product = store_models.Product.objects.get(status="Published", id=id)
    except store_models.Product.DoesNotExist:
        return JsonResponse({"error": "Товар не найден"}, status=404)

    # Check if the item is already in the cart
    item = store_models.Cart.objects.get(product=product, id=item_id)
    item.delete()

    # Count the total number of items in the cart
    total_cart_items = store_models.Cart.objects.filter(cart_id=cart_id)
    cart_sub_total = store_models.Cart.objects.filter(cart_id=cart_id).aggregate(sub_total = models.Sum("sub_total"))['sub_total']

    return JsonResponse({
        "message": "Товар удален",
        "total_cart_items": total_cart_items.count(),
        "cart_sub_total": "{:,.2f}".format(cart_sub_total) if cart_sub_total else 0.00
    })

def create_order(request):
    if request.method == "POST":
        address_id = request.POST.get("address")
        if not address_id:
            messages.warning(request, "Пожалуйста, выберите адрес для продолжения")
            return redirect("store:cart")
        
        address = customer_models.Address.objects.filter(user=request.user, id=address_id).first()

        if "cart_id" in request.session:
            cart_id = request.session['cart_id']
        else:
            cart_id = None

        items = store_models.Cart.objects.filter(cart_id=cart_id)
        cart_sub_total = store_models.Cart.objects.filter(cart_id=cart_id).aggregate(sub_total = models.Sum("sub_total"))['sub_total']
        cart_shipping_total = store_models.Cart.objects.filter(cart_id=cart_id).aggregate(shipping = models.Sum("shipping"))['shipping']
        
        order = store_models.Order()
        order.sub_total = cart_sub_total
        order.customer = request.user
        order.address = address
        order.shipping = cart_shipping_total
        order.tax = tax_calculation(address.country, cart_sub_total)
        order.total = order.sub_total + order.shipping + Decimal(order.tax)
        order.service_fee = calculate_service_fee(order.total)
        order.total += order.service_fee
        order.save()

        for i in items:
            store_models.OrderItem.objects.create(
                order=order,
                product=i.product,
                qty=i.qty,
                color=i.color,
                size=i.size,
                price=i.price,
                sub_total=i.sub_total,
                shipping=i.shipping,
                tax=tax_calculation(address.country, i.sub_total),
                total=i.total,
                initial_total=i.total,
                vendor=i.product.vendor
            )

            order.vendors.add(i.product.vendor)
        
    
    return redirect("store:checkout", order.order_id)

def coupon_apply(request, order_id):
    print("Order Id ========", order_id)
    
    try:
        order = store_models.Order.objects.get(order_id=order_id)
        order_items = store_models.OrderItem.objects.filter(order=order)
    except store_models.Order.DoesNotExist:
        messages.error(request, "Заказ не найден")
        return redirect("store:cart")

    if request.method == 'POST':
        coupon_code = request.POST.get("coupon_code")
        
        if not coupon_code:
            messages.error(request, "Купон не введён")
            return redirect("store:checkout", order.order_id)
            
        try:
            coupon = store_models.Coupon.objects.get(code=coupon_code)
        except store_models.Coupon.DoesNotExist:
            messages.error(request, "Купон не существует")
            return redirect("store:checkout", order.order_id)
        
        if coupon in order.coupons.all():
            messages.warning(request, "Купон уже активирован")
            return redirect("store:checkout", order.order_id)
        else:
            # Assuming coupon applies to specific vendor items, not globally
            total_discount = 0
            for item in order_items:
                if coupon.vendor == item.product.vendor and coupon not in item.coupon.all():
                    item_discount = item.total * coupon.discount / 100  # Discount for this item
                    total_discount += item_discount

                    item.coupon.add(coupon) 
                    item.total -= item_discount
                    item.saved += item_discount
                    item.save()

            # Apply total discount to the order after processing all items
            if total_discount > 0:
                order.coupons.add(coupon)
                order.total -= total_discount
                order.sub_total -= total_discount
                order.saved += total_discount
                order.save()
        
        messages.success(request, "Купон активирован")
        return redirect("store:checkout", order.order_id)

def checkout(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)
    
    amount_in_inr = convert_usd_to_inr(order.total)
    amount_in_kobo = convert_usd_to_kobo(order.total)
    amount_in_ngn = convert_usd_to_ngn(order.total)

    try:
        razorpay_order = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)).order.create({
            "amount": int(amount_in_inr),
            "currency": "INR",
            "payment_capture": "1"
        })
    except:
        razorpay_order = None
    context = {
        "order": order,
        "amount_in_inr":amount_in_inr,
        "amount_in_kobo":amount_in_kobo,
        "amount_in_ngn":round(amount_in_ngn, 2),
        "razorpay_order_id": razorpay_order['id'] if razorpay_order else None,
        "stripe_public_key": settings.STRIPE_PUBLIC_KEY,
        "paypal_client_id": settings.PAYPAL_CLIENT_ID,
        "razorpay_key_id":settings.RAZORPAY_KEY_ID,
        "paystack_public_key":settings.PAYSTACK_PUBLIC_KEY,
        "flutterwave_public_key":settings.FLUTTERWAVE_PUBLIC_KEY,
    }

    return render(request, "store/checkout.html", context)

@csrf_exempt
def stripe_payment(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)
    stripe.api_key = settings.STRIPE_SECRET_KEY

    checkout_session = stripe.checkout.Session.create(
        customer_email = order.address.email,
        payment_method_types=['card'],
        line_items = [
            {
                'price_data': {
                    'currency': 'USD',
                    'product_data': {
                        'name': order.address.full_name
                    },
                    'unit_amount': int(order.total * 100)
                },
                'quantity': 1
            }
        ],
        mode = 'payment',
        success_url = request.build_absolute_uri(reverse("store:stripe_payment_verify", args=[order.order_id])) + "?session_id={CHECKOUT_SESSION_ID}" + "&payment_method=Stripe",
        cancel_url = request.build_absolute_uri(reverse("store:stripe_payment_verify", args=[order.order_id]))
    )

    print("checkkout session", checkout_session)
    return JsonResponse({"sessionId": checkout_session.id})

def stripe_payment_verify(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)

    session_id = request.GET.get("session_id")
    session = stripe.checkout.Session.retrieve(session_id)

    if session.payment_status == "paid":
        if order.payment_status == "Processing":
            order.payment_status = "Paid"
            order.save()
            clear_cart_items(request)
            customer_models.Notifications.objects.create(type="New Order", user=request.user)
            customer_merge_data = {
                'order': order,
                'order_items': order.order_items(),
            }
            subject = f"New Order!"
            text_body = render_to_string("email/order/customer/customer_new_order.txt", customer_merge_data)
            html_body = render_to_string("email/order/customer/customer_new_order.html", customer_merge_data)

            msg = EmailMultiAlternatives(
                subject=subject, from_email=settings.FROM_EMAIL,
                to=[order.address.email], body=text_body
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send()

            # Send Order Emails to Vendors
            for item in order.order_items():
                
                vendor_merge_data = {
                    'item': item,
                }
                subject = f"New Order!"
                text_body = render_to_string("email/order/vendor/vendor_new_order.txt", vendor_merge_data)
                html_body = render_to_string("email/order/vendor/vendor_new_order.html", vendor_merge_data)

                msg = EmailMultiAlternatives(
                    subject=subject, from_email=settings.FROM_EMAIL,
                    to=[item.vendor.email], body=text_body
                )
                msg.attach_alternative(html_body, "text/html")
                msg.send()

            return redirect(f"/payment_status/{order.order_id}/?payment_status=paid")
    
    return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")
    
def get_paypal_access_token():
    token_url = 'https://api.sandbox.paypal.com/v1/oauth2/token'
    data = {'grant_type': 'client_credentials'}
    auth = (settings.PAYPAL_CLIENT_ID, settings.PAYPAL_SECRET_ID)
    response = requests.post(token_url, data=data, auth=auth)

    if response.status_code == 200:
        return response.json()['access_token']
    else:
        raise Exception(f'Failed to get access token from PayPal. Status code: {response.status_code}') 

def paypal_payment_verify(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)

    transaction_id = request.GET.get("transaction_id")
    paypal_api_url = f'https://api-m.sandbox.paypal.com/v2/checkout/orders/{transaction_id}'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {get_paypal_access_token()}',
    }
    response = requests.get(paypal_api_url, headers=headers)

    if response.status_code == 200:
        paypal_order_data = response.json()
        paypal_payment_status = paypal_order_data['status']
        if paypal_payment_status == 'COMPLETED':
            if order.payment_status == "Processing":
                order.payment_status = "Paid"
                payment_method = request.GET.get("payment_method")
                order.payment_method = payment_method
                order.save()
                clear_cart_items(request)
                return redirect(f"/payment_status/{order.order_id}/?payment_status=paid")
    else:
        return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")

@csrf_exempt
def razorpay_payment_verify(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)
    payment_method = request.GET.get("payment_method")

    if request.method == "POST":
        data = request.POST

        # Extract payment data
        razorpay_order_id = data.get('razorpay_order_id')
        razorpay_payment_id = data.get('razorpay_payment_id')
        razorpay_signature = data.get('razorpay_signature')

        print("razorpay_order_id: ====", razorpay_order_id)
        print("razorpay_payment_id: ====", razorpay_payment_id)
        print("razorpay_signature: ====", razorpay_signature)

        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }

        # Verify the payment signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })

        razorpay_client.utility.verify_payment_signature(params_dict)

        # Success response
        if order.payment_status == "Processing":
            order.payment_status = "Paid"
            order.payment_method = payment_method
            order.save()
            clear_cart_items(request)
            customer_models.Notifications.objects.create(type="New Order", user=request.user)
            for item in order.order_items():
                vendor_models.Notifications.objects.create(type="New Order", user=item.vendor)

            return redirect(f"/payment_status/{order.order_id}/?payment_status=paid")

        

    return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")

def paystack_payment_verify(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)
    reference = request.GET.get('reference', '')

    if reference:
        headers = {
            "Authorization": f"Bearer {settings.PAYSTACK_PRIVATE_KEY}",
            "Content-Type": "application/json"
        }

        # Verify the transaction
        response = requests.get(f'https://api.paystack.co/transaction/verify/{reference}', headers=headers)
        response_data = response.json()

        if response_data['status']:
            if response_data['data']['status'] == 'success':
                if order.payment_status == "Processing":
                    order.payment_status = "Paid"
                    payment_method = request.GET.get("payment_method")
                    order.payment_method = payment_method
                    order.save()
                    clear_cart_items(request)
                    return redirect(f"/payment_status/{order.order_id}/?payment_status=paid")
                else:
                    return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")
            else:
                # Payment failed
                return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")
        else:
            return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")
    else:
        return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")

def flutterwave_payment_callback(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)

    payment_id = request.GET.get('tx_ref')
    status = request.GET.get('status')

    headers = {
        'Authorization': f'Bearer {settings.FLUTTERWAVE_PRIVATE_KEY}'
    }
    response = requests.get(f'https://api.flutterwave.com/v3/charges/verify_by_id/{payment_id}', headers=headers)

    if response.status_code == 200:
        if order.payment_status == "Processing":
            order.payment_status = "Paid"
            payment_method = request.GET.get("payment_method")
            order.payment_method = payment_method
            order.save()
            clear_cart_items(request)
            return redirect(f"/payment_status/{order.order_id}/?payment_status=paid")
        else:
            return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")
    else:
        return redirect(f"/payment_status/{order.order_id}/?payment_status=failed")

def payment_status(request, order_id):
    order = store_models.Order.objects.get(order_id=order_id)
    payment_status = request.GET.get("payment_status")

    context = {
        "order": order,
        "payment_status": payment_status
    }
    return render(request, "store/payment_status.html", context)

def filter_products(request):
    """
    Улучшенная функция фильтрации товаров с поддержкой:
    - AJAX запросов без перезагрузки страницы
    - Пагинации для infinite scroll
    - Оптимизированных запросов (select_related, prefetch_related)
    - Возврат JSON с HTML и метаданными
    - Новые фильтры: бренд, наличие, новинки, скидки, диапазон цен
    """
    from django.core.paginator import Paginator
    from django.db.models import Avg
    
    # Начинаем с базового queryset только опубликованных товаров
    # Оптимизация: используем select_related для ForeignKey и prefetch_related для обратных связей
    products = store_models.Product.objects.filter(status="Published").select_related('category', 'vendor').prefetch_related('reviews', 'product_variants')

    # Получаем фильтры из AJAX запроса
    categories = request.GET.getlist('categories[]')
    rating = request.GET.getlist('rating[]')
    sizes = request.GET.getlist('sizes[]')
    colors = request.GET.getlist('colors[]')
    brands = request.GET.getlist('brands[]')
    price_order = request.GET.get('prices')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    in_stock = request.GET.get('in_stock')  # 'true' или 'false'
    is_new = request.GET.get('is_new')  # 'true' или 'false'
    has_discount = request.GET.get('has_discount')  # 'true' или 'false'
    search_filter = request.GET.get('searchFilter')
    display = request.GET.get('display')
    page = request.GET.get('page', 1)  # Для пагинации
    per_page = int(request.GET.get('per_page', 20))  # Количество товаров на странице

    # Применяем фильтр по категориям
    if categories:
        try:
            category_ids = [int(cat_id) for cat_id in categories if cat_id and str(cat_id).isdigit()]
            if category_ids:
                products = products.filter(category__id__in=category_ids)
        except (ValueError, TypeError) as e:
            print(f"Error converting category IDs: {e}")

    # Применяем фильтр по рейтингу
    if rating:
        rating_values = [int(r) for r in rating if r.isdigit()]
        if rating_values:
            # Фильтруем товары, у которых средний рейтинг >= выбранного значения
            rating_conditions = Q()
            for r_val in rating_values:
                rating_conditions |= Q(reviews__rating__gte=r_val)
            products = products.filter(rating_conditions).distinct()

    # Применяем фильтр по размерам (только через ProductVariant)
    if sizes:
        products = products.filter(
            product_variants__size__in=sizes, 
            product_variants__is_available=True
        ).distinct()

    # Применяем фильтр по цветам (только через ProductVariant)
    if colors:
        products = products.filter(
            product_variants__color__in=colors, 
            product_variants__is_available=True
        ).distinct()

    # Применяем фильтр по брендам
    if brands:
        products = products.filter(brand__in=brands).distinct()

    # Применяем фильтр по наличию
    if in_stock == 'true':
        products = products.filter(in_stock=True)
    elif in_stock == 'false':
        products = products.filter(in_stock=False)

    # Применяем фильтр по новинкам
    if is_new == 'true':
        products = products.filter(is_new=True)

    # Применяем фильтр по скидкам (есть regular_price > price)
    if has_discount == 'true':
        products = products.filter(regular_price__gt=F('price'))

    # Применяем фильтр по диапазону цен
    if min_price:
        try:
            min_price_decimal = Decimal(min_price)
            products = products.filter(price__gte=min_price_decimal)
        except (ValueError, TypeError):
            pass

    if max_price:
        try:
            max_price_decimal = Decimal(max_price)
            products = products.filter(price__lte=max_price_decimal)
        except (ValueError, TypeError):
            pass

    # Применяем поисковый фильтр
    if search_filter:
        products = products.filter(
            Q(name__icontains=search_filter) |
            Q(description__icontains=search_filter) |
            Q(brand__icontains=search_filter) |
            Q(category__title__icontains=search_filter)
        )

    # Применяем сортировку
    if price_order == 'lowest':
        products = products.order_by('-price')
    elif price_order == 'highest':
        products = products.order_by('price')
    elif price_order == 'rating':
        # Сортировка по рейтингу
        products = products.annotate(avg_rating=Avg('reviews__rating')).order_by('-avg_rating', '-date')
    elif price_order == 'popular':
        # Сортировка по популярности (количество отзывов)
        products = products.annotate(review_count=Count('reviews')).order_by('-review_count', '-date')
    else:
        # Сортировка по умолчанию (новые сначала)
        products = products.order_by('-date', '-id')

    # Получаем общее количество товаров ДО пагинации (для отображения)
    total_count = products.count()

    # Применяем пагинацию
    paginator = Paginator(products, per_page)
    try:
        page_obj = paginator.page(page)
        products_page = page_obj.object_list
    except:
        page_obj = paginator.page(1)
        products_page = page_obj.object_list

    # Ограничение количества товаров (если указано в display)
    if display and display.isdigit():
        display_count = int(display)
        if display_count < total_count:
            products_page = products_page[:display_count]

    # Рендерим отфильтрованные товары в HTML
    html = render_to_string('partials/_store.html', {'products': products_page})

    # Возвращаем JSON с HTML, метаданными и информацией о пагинации
    return JsonResponse({
        'html': html,
        'product_count': total_count,
        'page': page_obj.number,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous(),
        'num_pages': paginator.num_pages,
        'per_page': per_page
    })


def get_filter_metadata(request):
    """
    API endpoint для получения метаданных фильтров:
    - Количество товаров в каждой категории
    - Доступные бренды с количеством
    - Доступные размеры с количеством
    - Доступные цвета с количеством
    - Минимальная и максимальная цена
    """
    
    # Базовый queryset опубликованных товаров
    base_products = store_models.Product.objects.filter(status="Published")
    
    # Получаем текущие фильтры (для подсчета количества с учетом других фильтров)
    current_categories = request.GET.getlist('categories[]')
    current_brands = request.GET.getlist('brands[]')
    current_rating = request.GET.getlist('rating[]')
    current_sizes = request.GET.getlist('sizes[]')
    current_colors = request.GET.getlist('colors[]')
    min_price = request.GET.get('min_price')
    max_price = request.GET.get('max_price')
    in_stock = request.GET.get('in_stock')
    is_new = request.GET.get('is_new')
    has_discount = request.GET.get('has_discount')
    search_filter = request.GET.get('searchFilter')
    
    # Применяем все фильтры кроме того, для которого считаем метаданные
    filtered_products = base_products
    
    if current_brands:
        filtered_products = filtered_products.filter(brand__in=current_brands)
    if current_rating:
        rating_values = [int(r) for r in current_rating if r.isdigit()]
        if rating_values:
            rating_conditions = Q()
            for r_val in rating_values:
                rating_conditions |= Q(reviews__rating__gte=r_val)
            filtered_products = filtered_products.filter(rating_conditions).distinct()
    if current_sizes:
        filtered_products = filtered_products.filter(
            product_variants__size__in=current_sizes, 
            product_variants__is_available=True
        ).distinct()
    if current_colors:
        filtered_products = filtered_products.filter(
            product_variants__color__in=current_colors, 
            product_variants__is_available=True
        ).distinct()
    if min_price:
        try:
            filtered_products = filtered_products.filter(price__gte=Decimal(min_price))
        except:
            pass
    if max_price:
        try:
            filtered_products = filtered_products.filter(price__lte=Decimal(max_price))
        except:
            pass
    if in_stock == 'true':
        filtered_products = filtered_products.filter(in_stock=True)
    if is_new == 'true':
        filtered_products = filtered_products.filter(is_new=True)
    if has_discount == 'true':
        filtered_products = filtered_products.filter(regular_price__gt=F('price'))
    if search_filter:
        filtered_products = filtered_products.filter(
            Q(name__icontains=search_filter) |
            Q(description__icontains=search_filter) |
            Q(brand__icontains=search_filter)
        )
    
    # Получаем метаданные
    metadata = {
        'categories': [],
        'brands': [],
        'sizes': [],
        'colors': [],
        'price_range': {
            'min': 0,
            'max': 0
        }
    }
    
    # Категории с количеством товаров
    categories = store_models.Category.objects.annotate(
        product_count=Count('product', filter=Q(product__status='Published'))
    ).order_by('title')
    
    for cat in categories:
        # Подсчитываем количество с учетом текущих фильтров (кроме категорий)
        count = filtered_products.filter(category=cat).count()
        metadata['categories'].append({
            'id': cat.id,
            'title': cat.title,
            'count': count
        })
    
    # Бренды с количеством товаров
    brands_data = base_products.exclude(brand__isnull=True).exclude(brand='').values('brand').annotate(
        count=Count('id')
    ).order_by('brand')
    
    for brand_data in brands_data:
        brand_name = brand_data['brand']
        # Подсчитываем с учетом текущих фильтров (кроме брендов)
        count = filtered_products.filter(brand=brand_name).count()
        metadata['brands'].append({
            'name': brand_name,
            'count': count
        })
    
    # Размеры с количеством товаров
    sizes_data = {}
    # Из Variant
    variant_sizes = store_models.VariantItem.objects.filter(
        variant__name='Size'
    ).values('content').distinct()
    for size_item in variant_sizes:
        size_name = size_item['content']
        if size_name:
            count = filtered_products.filter(
                product_variants__size=size_name, 
                product_variants__is_available=True
            ).distinct().count()
            sizes_data[size_name] = count
    
    # Из ProductVariant
    product_variant_sizes = store_models.ProductVariant.objects.filter(
        is_available=True, size__isnull=False
    ).exclude(size='').values('size').distinct()
    for pv_size in product_variant_sizes:
        size_name = pv_size['size']
        if size_name and size_name not in sizes_data:
            count = filtered_products.filter(
                product_variants__size=size_name, 
                product_variants__is_available=True
            ).distinct().count()
            sizes_data[size_name] = count
    
    for size_name, count in sorted(sizes_data.items()):
        metadata['sizes'].append({
            'name': size_name,
            'count': count
        })
    
    # Цвета с количеством товаров
    colors_data = {}
    # Из Variant
    variant_colors = store_models.VariantItem.objects.filter(
        variant__name='Color'
    ).values('content', 'title').distinct()
    for color_item in variant_colors:
        color_name = color_item['content'] or color_item['title']
        if color_name:
            count = filtered_products.filter(
                product_variants__color=color_name, 
                product_variants__is_available=True
            ).distinct().count()
            colors_data[color_name] = {
                'count': count,
                'name': color_item['title'] or color_name
            }
    
    # Из ProductVariant
    product_variant_colors = store_models.ProductVariant.objects.filter(
        is_available=True, color__isnull=False
    ).exclude(color='').values('color', 'color_code').distinct()
    for pv_color in product_variant_colors:
        color_name = pv_color['color']
        if color_name and color_name not in colors_data:
            count = filtered_products.filter(
                product_variants__color=color_name, 
                product_variants__is_available=True
            ).distinct().count()
            colors_data[color_name] = {
                'count': count,
                'name': color_name,
                'code': pv_color.get('color_code')
            }
    
    for color_name, color_info in sorted(colors_data.items()):
        metadata['colors'].append({
            'name': color_name,
            'display_name': color_info['name'],
            'code': color_info.get('code'),
            'count': color_info['count']
        })
    
    # Диапазон цен
    price_stats = base_products.aggregate(
        min_price=Min('price'),
        max_price=Max('price')
    )
    metadata['price_range'] = {
        'min': float(price_stats['min_price'] or 0),
        'max': float(price_stats['max_price'] or 0)
    }
    
    return JsonResponse(metadata)

def order_tracker_page(request):
    if request.method == "POST":
        item_id = request.POST.get("item_id")
        return redirect("store:order_tracker_detail", item_id)
    
    return render(request, "store/order_tracker_page.html")

def order_tracker_detail(request, item_id):
    try:
        item = store_models.OrderItem.objects.filter(models.Q(item_id=item_id) | models.Q(tracking_id=item_id)).first()
    except:
        item = None
        messages.error(request, "Заказ не найден!")
        return redirect("store:order_tracker_page")
    
    context = {
        "item": item,
    }
    return render(request, "store/order_tracker.html", context)

def about(request):
    return render(request, "pages/about.html")

def contact(request):
    if request.method == "POST":
        full_name = request.POST.get("full_name")
        email = request.POST.get("email")
        subject = request.POST.get("subject")
        message = request.POST.get("message")

        userauths_models.ContactMessage.objects.create(
            full_name=full_name,
            email=email,
            subject=subject,
            message=message,
        )
        messages.success(request, "Сообщение успешно отправлено")
        return redirect("store:contact")
    return render(request, "pages/contact.html")

def faqs(request):
    return render(request, "pages/faqs.html")

def privacy_policy(request):
    return render(request, "pages/privacy_policy.html")

def terms_conditions(request):
    return render(request, "pages/terms_conditions.html")