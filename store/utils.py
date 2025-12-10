"""
Утилиты для фильтрации товаров в стиле Wildberries
Полностью переписанная логика с корректной обработкой всех фильтров
"""
from decimal import Decimal, InvalidOperation
from django.db.models import Q, Count, Avg, Min, Max, F
from django.core.paginator import Paginator
from django.http import QueryDict


def build_product_filters(request, base_queryset, category=None):
    """
    Строит QuerySet с применением всех фильтров из GET параметров
    Аналогично логике Wildberries - полностью рабочая версия
    
    Args:
        request: HttpRequest объект
        base_queryset: Базовый QuerySet (обычно Product.objects.filter(status="Published"))
        category: Категория для фильтрации (опционально)
    
    Returns:
        tuple: (filtered_queryset, selected_filters)
    """
    products_list = base_queryset
    
    # Если указана категория, фильтруем по ней
    if category:
        products_list = products_list.filter(category=category)
    
    # Словарь для хранения выбранных фильтров (для отображения тегов)
    selected_filters = {}
    
    # ========== ПОИСК ==========
    query = request.GET.get("q", "").strip()
    if query:
        products_list = products_list.filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(brand__icontains=query)
        )
        selected_filters['q'] = query
    
    # ========== ФИЛЬТР ПО ЦЕНЕ (MIN/MAX) ==========
    min_price = request.GET.get("price_min", "").strip()
    max_price = request.GET.get("price_max", "").strip()
    
    if min_price:
        try:
            min_price_decimal = Decimal(min_price)
            products_list = products_list.filter(price__gte=min_price_decimal)
            selected_filters['price_min'] = str(min_price_decimal)
        except (ValueError, TypeError, InvalidOperation):
            pass
    
    if max_price:
        try:
            max_price_decimal = Decimal(max_price)
            products_list = products_list.filter(price__lte=max_price_decimal)
            selected_filters['price_max'] = str(max_price_decimal)
        except (ValueError, TypeError, InvalidOperation):
            pass
    
    # ========== ФИЛЬТР ПО КАТЕГОРИЯМ (множественный выбор) ==========
    categories_filter = request.GET.getlist('category') or request.GET.getlist('categories[]') or request.GET.getlist('categories')
    if categories_filter:
        try:
            category_ids = []
            for cat_id in categories_filter:
                if cat_id and str(cat_id).strip():
                    try:
                        cat_id_int = int(cat_id)
                        if cat_id_int > 0:
                            category_ids.append(cat_id_int)
                    except (ValueError, TypeError):
                        continue
            
            if category_ids:
                products_list = products_list.filter(category__id__in=category_ids)
                selected_filters['categories'] = category_ids
        except (ValueError, TypeError):
            pass
    
    # ========== ФИЛЬТР ПО РАЗМЕРАМ (множественный выбор) ==========
    sizes_filter = request.GET.getlist('size') or request.GET.getlist('sizes[]') or request.GET.getlist('sizes')
    if sizes_filter:
        # Очищаем от пустых значений
        sizes_clean = [s.strip() for s in sizes_filter if s and str(s).strip()]
        if sizes_clean:
            # Фильтр только через ProductVariant (более надежный способ)
            products_list = products_list.filter(
                product_variants__size__in=sizes_clean, 
                product_variants__is_available=True
            ).distinct()
            selected_filters['sizes'] = sizes_clean
    
    # ========== ФИЛЬТР ПО ЦВЕТАМ (множественный выбор) ==========
    colors_filter = request.GET.getlist('color') or request.GET.getlist('colors[]') or request.GET.getlist('colors')
    if colors_filter:
        # Очищаем от пустых значений
        colors_clean = [c.strip() for c in colors_filter if c and str(c).strip()]
        if colors_clean:
            # Фильтр только через ProductVariant (более надежный способ)
            products_list = products_list.filter(
                product_variants__color__in=colors_clean, 
                product_variants__is_available=True
            ).distinct()
            selected_filters['colors'] = colors_clean
    
    # ========== ФИЛЬТР ПО БРЕНДАМ (множественный выбор) ==========
    brands_filter = request.GET.getlist('brand') or request.GET.getlist('brands[]') or request.GET.getlist('brands')
    if brands_filter:
        # Очищаем от пустых значений
        brands_clean = [b.strip() for b in brands_filter if b and str(b).strip()]
        if brands_clean:
            products_list = products_list.filter(brand__in=brands_clean).distinct()
            selected_filters['brands'] = brands_clean
    
    # ========== ФИЛЬТР ПО СЕЗОНУ (множественный выбор) ==========
    seasons_filter = request.GET.getlist('season') or request.GET.getlist('seasons[]') or request.GET.getlist('seasons')
    if seasons_filter:
        # Очищаем от пустых значений
        seasons_clean = [s.strip() for s in seasons_filter if s and str(s).strip()]
        if seasons_clean:
            products_list = products_list.filter(season__in=seasons_clean).distinct()
            selected_filters['seasons'] = seasons_clean
    
    # ========== ФИЛЬТР ПО МАТЕРИАЛУ (множественный выбор) ==========
    materials_filter = request.GET.getlist('material') or request.GET.getlist('materials[]') or request.GET.getlist('materials')
    if materials_filter:
        # Очищаем от пустых значений
        materials_clean = [m.strip() for m in materials_filter if m and str(m).strip()]
        if materials_clean:
            products_list = products_list.filter(material__in=materials_clean).distinct()
            selected_filters['materials'] = materials_clean
    
    # ========== ФИЛЬТР "ТОЛЬКО РАСПРОДАЖА" (toggle) ==========
    sale_only = request.GET.get('sale', '').strip()
    if sale_only in ('true', '1', 'True', 'TRUE'):
        # Товары со скидкой (regular_price > price)
        products_list = products_list.filter(
            regular_price__isnull=False
        ).filter(
            regular_price__gt=F('price')
        )
        selected_filters['sale'] = True
    
    # ========== СОРТИРОВКА ==========
    sort_by = request.GET.get('sort', 'popularity')
    
    if sort_by == 'price_asc':
        products_list = products_list.order_by('price', '-id')
        selected_filters['sort'] = 'price_asc'
    elif sort_by == 'price_desc':
        products_list = products_list.order_by('-price', '-id')
        selected_filters['sort'] = 'price_desc'
    elif sort_by == 'popularity':
        products_list = products_list.annotate(
            review_count=Count('reviews')
        ).order_by('-review_count', '-date', '-id')
        selected_filters['sort'] = 'popularity'
    elif sort_by == 'rating':
        products_list = products_list.annotate(
            avg_rating=Avg('reviews__rating')
        ).order_by('-avg_rating', '-date', '-id')
        selected_filters['sort'] = 'rating'
    else:
        products_list = products_list.order_by('-date', '-id')
        selected_filters['sort'] = 'date'
    
    return products_list, selected_filters


def build_active_filters(request, selected_filters, category_id):
    """
    Формирует список активных фильтров для отображения в виде тегов
    В формате Wildberries: [ Название: Значение × ]
    
    Args:
        request: HttpRequest объект
        selected_filters: Словарь выбранных фильтров из build_product_filters
        category_id: ID категории для формирования URL
    
    Returns:
        list: Список словарей с ключами 'name', 'value', 'remove_url'
    """
    from store import models as store_models
    from django.urls import reverse
    
    active_filters = []
    current_params = request.GET.copy()
    
    # Удаляем page из параметров при формировании URL удаления
    if 'page' in current_params:
        current_params = current_params.copy()
        current_params.pop('page')
    
    def create_remove_url(param_name, param_value):
        """Создает URL для удаления конкретного фильтра"""
        params = current_params.copy()
        
        # Для множественных параметров удаляем конкретное значение
        if param_name in params:
            values = params.getlist(param_name)
            param_value_str = str(param_value).strip()
            values = [v for v in values if str(v).strip() != param_value_str]
            if values:
                params.setlist(param_name, values)
            else:
                params.pop(param_name, None)
        else:
            # Если параметра нет в списке, но мы его удаляем (например, price_min при объединенной цене)
            params.pop(param_name, None)
            # Если удаляем price_min, также удаляем price_max для объединенной цены
            if param_name == 'price_min' and 'price_max' in params:
                params.pop('price_max', None)
            elif param_name == 'price_max' and 'price_min' in params:
                params.pop('price_min', None)
        
        # Формируем URL
        url = reverse('store:category', args=[category_id])
        query_string = params.urlencode()
        if query_string:
            url += '?' + query_string
        return url
    
    # ========== ПОИСК ==========
    if 'q' in selected_filters:
        active_filters.append({
            'name': 'Поиск',
            'value': selected_filters['q'],
            'remove_url': create_remove_url('q', selected_filters['q'])
        })
    
    # ========== ЦЕНА ==========
    price_min = selected_filters.get('price_min', '')
    price_max = selected_filters.get('price_max', '')
    
    if price_min and price_max:
        # Объединяем min и max в один тег
        active_filters.append({
            'name': 'Цена',
            'value': f'{price_min}–{price_max}',
            'remove_url': create_remove_url('price_min', price_min)  # Удаляем оба параметра
        })
    elif price_min:
        active_filters.append({
            'name': 'Цена',
            'value': f'От {price_min}',
            'remove_url': create_remove_url('price_min', price_min)
        })
    elif price_max:
        active_filters.append({
            'name': 'Цена',
            'value': f'До {price_max}',
            'remove_url': create_remove_url('price_max', price_max)
        })
    
    # ========== КАТЕГОРИИ ==========
    if 'categories' in selected_filters:
        for cat_id in selected_filters['categories']:
            try:
                cat = store_models.Category.objects.get(id=cat_id)
                active_filters.append({
                    'name': 'Категория',
                    'value': cat.title,
                    'remove_url': create_remove_url('category', cat_id)
                })
            except store_models.Category.DoesNotExist:
                pass
    
    # ========== РАЗМЕРЫ ==========
    if 'sizes' in selected_filters:
        for size in selected_filters['sizes']:
            active_filters.append({
                'name': 'Размер',
                'value': size,
                'remove_url': create_remove_url('size', size)
            })
    
    # ========== ЦВЕТА ==========
    if 'colors' in selected_filters:
        for color in selected_filters['colors']:
            active_filters.append({
                'name': 'Цвет',
                'value': color,
                'remove_url': create_remove_url('color', color)
            })
    
    # ========== БРЕНДЫ ==========
    if 'brands' in selected_filters:
        for brand in selected_filters['brands']:
            active_filters.append({
                'name': 'Бренд',
                'value': brand,
                'remove_url': create_remove_url('brand', brand)
            })
    
    # ========== СЕЗОНЫ ==========
    if 'seasons' in selected_filters:
        for season in selected_filters['seasons']:
            active_filters.append({
                'name': 'Сезон',
                'value': season,
                'remove_url': create_remove_url('season', season)
            })
    
    # ========== МАТЕРИАЛЫ ==========
    if 'materials' in selected_filters:
        for material in selected_filters['materials']:
            active_filters.append({
                'name': 'Материал',
                'value': material,
                'remove_url': create_remove_url('material', material)
            })
    
    # ========== РАСПРОДАЖА ==========
    if 'sale' in selected_filters:
        active_filters.append({
            'name': 'Распродажа',
            'value': 'Только распродажа',
            'remove_url': create_remove_url('sale', 'true')
        })
    
    return active_filters


def get_filter_options(base_queryset, category=None):
    """
    Получает опции для фильтров на основе текущего queryset
    """
    from store import models as store_models
    from django.db.models import Q
    
    filter_options = {}
    
    # Price Range
    price_range = base_queryset.aggregate(
        min_price=Min('price'),
        max_price=Max('price')
    )
    filter_options['price_range'] = price_range
    
    # Categories
    categories = store_models.Category.objects.annotate(
        product_count=Count('product', filter=Q(product__status='Published'))
    ).order_by('title')
    filter_options['categories'] = categories
    
    # Sizes
    if category:
        sizes_pv = store_models.ProductVariant.objects.filter(
            product__category=category,
            product__status='Published',
            is_available=True,
            size__isnull=False
        ).exclude(size='').values('size').distinct().order_by('size')
        
        sizes_variant = store_models.VariantItem.objects.filter(
            variant__name='Size',
            variant__product__category=category,
            variant__product__status='Published'
        ).values('title', 'content').distinct()
    else:
        sizes_pv = store_models.ProductVariant.objects.filter(
            product__status='Published',
            is_available=True,
            size__isnull=False
        ).exclude(size='').values('size').distinct().order_by('size')
        
        sizes_variant = store_models.VariantItem.objects.filter(
            variant__name='Size',
            variant__product__status='Published'
        ).values('title', 'content').distinct()
    
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
    
    filter_options['sizes'] = list(sizes_dict.values())
    
    # Colors
    if category:
        colors_pv = store_models.ProductVariant.objects.filter(
            product__category=category,
            product__status='Published',
            is_available=True,
            color__isnull=False
        ).exclude(color='').values('color', 'color_code').distinct()
        
        colors_variant = store_models.VariantItem.objects.filter(
            variant__name='Color',
            variant__product__category=category,
            variant__product__status='Published'
        ).values('title', 'content').distinct()
    else:
        colors_pv = store_models.ProductVariant.objects.filter(
            product__status='Published',
            is_available=True,
            color__isnull=False
        ).exclude(color='').values('color', 'color_code').distinct()
        
        colors_variant = store_models.VariantItem.objects.filter(
            variant__name='Color',
            variant__product__status='Published'
        ).values('title', 'content').distinct()
    
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
    
    filter_options['colors'] = list(colors_dict.values())
    
    # Brands
    if category:
        brands = base_queryset.filter(category=category).exclude(
            brand__isnull=True
        ).exclude(brand='').values('brand').annotate(
            count=Count('id')
        ).order_by('brand')
    else:
        brands = base_queryset.exclude(brand__isnull=True).exclude(
            brand=''
        ).values('brand').annotate(
            count=Count('id')
        ).order_by('brand')
    
    filter_options['brands'] = brands
    
    # Seasons
    if category:
        seasons = base_queryset.filter(
            category=category,
            season__isnull=False
        ).exclude(season='').values('season').annotate(
            count=Count('id')
        ).order_by('season')
    else:
        seasons = base_queryset.exclude(
            season__isnull=True
        ).exclude(season='').values('season').annotate(
            count=Count('id')
        ).order_by('season')
    
    filter_options['seasons'] = seasons
    
    # Materials
    if category:
        materials = base_queryset.filter(
            category=category,
            material__isnull=False
        ).exclude(material='').values('material').annotate(
            count=Count('id')
        ).order_by('material')
    else:
        materials = base_queryset.exclude(
            material__isnull=True
        ).exclude(material='').values('material').annotate(
            count=Count('id')
        ).order_by('material')
    
    filter_options['materials'] = materials
    
    return filter_options


def paginate_queryset(request, queryset, per_page=12):
    paginator = Paginator(queryset, per_page)
    page_number = request.GET.get('page', 1)
    try:
        page = paginator.get_page(page_number)
    except:
        page = paginator.get_page(1)
    return page
