from django.db import models
from shortuuid.django_fields import ShortUUIDField
from django.utils import timezone
from django.utils.text import slugify
from django_ckeditor_5.fields import CKEditor5Field

from userauths import models as user_models
from vendor import models as vendor_models

import shortuuid

STATUS = (
    ("Published", "Published"),
    ("Draft", "Draft"),
    ("Disabled", "Disabled"),
)

PAYMENT_STATUS = (
    ("Paid", "Paid"),
    ("Processing", "Processing"),
    ("Failed", 'Failed'),
)

PAYMENT_METHOD = (
    ("PayPal", "PayPal"),
    ("Stripe", "Stripe"),
    ("Flutterwave", "Flutterwave"),
    ("Paystack", "Paystack"),
    ("RazorPay", "RazorPay"),
)

ORDER_STATUS = (
    ("Pending", "Pending"),
    ("Processing", "Processing"),
    ("Shipped", "Shipped"),
    ("Fulfilled", "Fulfilled"),
    ("Cancelled", "Cancelled"),
)

SHIPPING_SERVICE = (
    ("DHL", "DHL"),
    ("FedX", "FedX"),
    ("UPS", "UPS"),
    ("GIG Logistics", "GIG Logistics")
)

RATING = (
    (1, "★☆☆☆☆"),
    (2, "★★☆☆☆"),
    (3, "★★★☆☆"),
    (4, "★★★★☆"),
    (5, "★★★★★"),
)


class Category(models.Model):
    title = models.CharField(max_length=100)
    image = models.ImageField(upload_to="images", default="category.jpg", null=True, blank=True)
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name_plural = "Категории"

    def __str__(self):
        return self.title

    def products(self):
        return Product.objects.filter(category=self)


class Product(models.Model):
    name = models.CharField(max_length=100)
    image = models.FileField(upload_to="images", blank=True, null=True, default="product.jpg")
    description = CKEditor5Field('Text', config_name='extends')

    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, db_index=True)
    brand = models.CharField(max_length=100, null=True, blank=True, verbose_name="Бренд", db_index=True)
    season = models.CharField(max_length=50, null=True, blank=True, verbose_name="Сезон", db_index=True,
                              help_text="Например: Зима, Лето, Демисезон")
    material = models.CharField(max_length=100, null=True, blank=True, verbose_name="Материал", db_index=True,
                                help_text="Например: Кожа, Текстиль, Резина")

    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True,
                                verbose_name="Цена продажи", db_index=True)
    regular_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True,
                                        verbose_name="Обычная цена")

    stock = models.PositiveIntegerField(default=0, null=True, blank=True)
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True,
                                   verbose_name="Стоимость доставки")

    status = models.CharField(choices=STATUS, max_length=50, default="Published", db_index=True)
    featured = models.BooleanField(default=False, verbose_name="Рекомендовано на маркетплейсе", db_index=True)
    is_new = models.BooleanField(default=False, verbose_name="Новинка", db_index=True)
    in_stock = models.BooleanField(default=True, verbose_name="В наличии", db_index=True)

    vendor = models.ForeignKey(user_models.User, on_delete=models.SET_NULL, null=True, blank=True)

    sku = ShortUUIDField(unique=True, length=5, max_length=50, prefix="SKU", alphabet="1234567890")
    slug = models.SlugField(null=True, blank=True, db_index=True)

    date = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Продукты"
        indexes = [
            models.Index(fields=['status', 'category', 'price']),
            models.Index(fields=['status', 'featured']),
            models.Index(fields=['status', 'is_new']),
            models.Index(fields=['status', 'in_stock']),
        ]

    def __str__(self):
        return self.name

    def average_rating(self):
        return Review.objects.filter(product=self).aggregate(avg_rating=models.Avg('rating'))['avg_rating']

    def reviews(self):
        return Review.objects.filter(product=self)

    def gallery(self):
        return Gallery.objects.filter(product=self)

    def variants(self):
        return Variant.objects.filter(product=self)

    def vendor_orders(self):
        return OrderItem.objects.filter(product=self, vendor=self.vendor)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name) + "-" + str(shortuuid.uuid().lower()[:2])

        super(Product, self).save(*args, **kwargs)


class Variant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True)
    name = models.CharField(max_length=1000, verbose_name="Название варианта", null=True, blank=True)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Варианты"

    def items(self):
        return VariantItem.objects.filter(variant=self)

    def __str__(self):
        return self.name


class VariantItem(models.Model):
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name='variant_items')
    title = models.CharField(max_length=1000, verbose_name="Название", null=True, blank=True)
    content = models.CharField(max_length=1000, verbose_name="Контент", null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Варианты товара"
        indexes = [
            models.Index(fields=['variant', 'content']),
        ]

    def __str__(self):
        return self.variant.name


class ProductVariant(models.Model):
    """
    Модель для вариантов товаров с размером, цветом и наличием
    Используется для более структурированного хранения вариантов
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='product_variants', db_index=True)
    size = models.CharField(max_length=50, null=True, blank=True, verbose_name="Размер", db_index=True)
    color = models.CharField(max_length=100, null=True, blank=True, verbose_name="Цвет", db_index=True)
    color_code = models.CharField(max_length=7, null=True, blank=True, verbose_name="Код цвета (HEX)", 
                                  help_text="Например: #FF0000 для красного")
    stock = models.PositiveIntegerField(default=0, null=True, blank=True, verbose_name="Количество на складе")
    is_available = models.BooleanField(default=True, verbose_name="Доступен", db_index=True)
    price_modifier = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True,
                                         verbose_name="Изменение цены", 
                                         help_text="Дополнительная стоимость для этого варианта")
    sku = ShortUUIDField(unique=True, length=8, max_length=50, prefix="VAR", alphabet="1234567890")
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Варианты продуктов"
        indexes = [
            models.Index(fields=['product', 'size', 'is_available']),
            models.Index(fields=['product', 'color', 'is_available']),
            models.Index(fields=['product', 'is_available']),
        ]

    def __str__(self):
        variant_str = f"{self.product.name}"
        if self.size:
            variant_str += f" - {self.size}"
        if self.color:
            variant_str += f" - {self.color}"
        return variant_str

    def get_final_price(self):
        """Возвращает итоговую цену с учетом модификатора"""
        if self.product.price and self.price_modifier:
            return self.product.price + self.price_modifier
        return self.product.price or 0


class Gallery(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True)
    image = models.FileField(upload_to="images", default="gallery.jpg")
    gallery_id = ShortUUIDField(length=6, max_length=10, alphabet="1234567890")

    class Meta:
        verbose_name_plural = "Галлереи"

    def __str__(self):
        return f"{self.product.name} - image"


class Cart(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    user = models.ForeignKey(user_models.User, on_delete=models.SET_NULL, null=True, blank=True)
    qty = models.PositiveIntegerField(default=0, null=True, blank=True)
    price = models.DecimalField(decimal_places=2, max_digits=12, default=0.00, null=True, blank=True)
    sub_total = models.DecimalField(decimal_places=2, max_digits=12, default=0.00, null=True, blank=True)
    shipping = models.DecimalField(decimal_places=2, max_digits=12, default=0.00, null=True, blank=True)
    tax = models.DecimalField(decimal_places=2, max_digits=12, default=0.00, null=True, blank=True)
    total = models.DecimalField(decimal_places=2, max_digits=12, default=0.00, null=True, blank=True)
    size = models.CharField(max_length=100, null=True, blank=True)
    color = models.CharField(max_length=100, null=True, blank=True)
    cart_id = models.CharField(max_length=1000, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name_plural = "Корзина"

    def __str__(self):
        return f'{self.cart_id} - {self.product.name}'


class Coupon(models.Model):
    vendor = models.ForeignKey(user_models.User, on_delete=models.SET_NULL, null=True)
    code = models.CharField(max_length=100)
    discount = models.IntegerField(default=1)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Купоны"

    def __str__(self):
        return self.code


class Order(models.Model):
    vendors = models.ManyToManyField(user_models.User, blank=True)
    customer = models.ForeignKey(user_models.User, on_delete=models.SET_NULL, null=True, related_name="customer",
                                 blank=True)
    sub_total = models.DecimalField(default=0.00, max_digits=12, decimal_places=2)
    shipping = models.DecimalField(default=0.00, max_digits=12, decimal_places=2)
    tax = models.DecimalField(default=0.00, max_digits=12, decimal_places=2)
    service_fee = models.DecimalField(default=0.00, max_digits=12, decimal_places=2)
    total = models.DecimalField(default=0.00, max_digits=12, decimal_places=2)
    payment_status = models.CharField(max_length=100, choices=PAYMENT_STATUS, default="Processing")
    payment_method = models.CharField(max_length=100, choices=PAYMENT_METHOD, default=None, null=True, blank=True)
    order_status = models.CharField(max_length=100, choices=ORDER_STATUS, default="Pending")
    initial_total = models.DecimalField(default=0.00, max_digits=12, decimal_places=2, help_text="Цена до скидки")
    saved = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True,
                                help_text="Сколько клиент сэкономит")
    address = models.ForeignKey("customer.Address", on_delete=models.SET_NULL, null=True)
    coupons = models.ManyToManyField(Coupon, blank=True)
    order_id = ShortUUIDField(length=6, max_length=25, alphabet="1234567890")
    payment_id = models.CharField(null=True, blank=True, max_length=1000)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "Заказы"
        ordering = ['-date']

    def __str__(self):
        return self.order_id

    def order_items(self):
        return OrderItem.objects.filter(order=self)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    order_status = models.CharField(max_length=100, choices=ORDER_STATUS, default="Pending")
    shipping_service = models.CharField(max_length=100, choices=SHIPPING_SERVICE, default=None, null=True, blank=True)
    tracking_id = models.CharField(max_length=100, default=None, null=True, blank=True)

    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty = models.IntegerField(default=0)
    color = models.CharField(max_length=100, null=True, blank=True)
    size = models.CharField(max_length=100, null=True, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    shipping = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax = models.DecimalField(default=0.00, max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    initial_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00,
                                        help_text="Итоговая сумма без учёта скидки")
    saved = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, null=True, blank=True,
                                help_text="Сумма, сэкономленная покупателем")
    coupon = models.ManyToManyField(Coupon, blank=True)
    applied_coupon = models.BooleanField(default=False)
    item_id = ShortUUIDField(length=6, max_length=25, alphabet="1234567890")
    vendor = models.ForeignKey(user_models.User, on_delete=models.SET_NULL, null=True,
                               related_name="vendor_order_items")
    date = models.DateTimeField(default=timezone.now)

    def order_id(self):
        return f"{self.order.order_id}"

    def __str__(self):
        return self.item_id

    class Meta:
        ordering = ['-date']
        verbose_name_plural = "Заказы продукта"


class Review(models.Model):
    user = models.ForeignKey(user_models.User, on_delete=models.SET_NULL, blank=True, null=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, blank=True, null=True, related_name="reviews")
    review = models.TextField(null=True, blank=True)
    reply = models.TextField(null=True, blank=True)
    rating = models.IntegerField(choices=RATING, default=None)
    active = models.BooleanField(default=False)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Отзывы"

    def __str__(self):
        return f"{self.user.username} review on {self.product.name}"


BANNER_TYPE = (
    ("main", "Главный баннер"),
    ("small", "Малый баннер"),
)

class Banner(models.Model):
    banner_type = models.CharField(max_length=10, choices=BANNER_TYPE, default="main", verbose_name="Тип баннера")
    title = models.CharField(max_length=200, verbose_name="Заголовок")
    text = models.TextField(blank=True, null=True, verbose_name="Текст")
    button_text = models.CharField(max_length=100, blank=True, null=True, verbose_name="Текст кнопки")
    button_link = models.CharField(max_length=500, blank=True, null=True, verbose_name="Ссылка кнопки")
    image = models.ImageField(
        upload_to="banners", 
        blank=True, 
        null=True, 
        verbose_name="Изображение",
        help_text="Рекомендуемые размеры: Главный баннер - 1200x400px, Малый баннер - 400x200px. Формат: JPG, PNG"
    )
    background_color = models.CharField(max_length=100, default="#FF0000", verbose_name="Цвет фона")
    status = models.CharField(choices=STATUS, max_length=50, default="Published", verbose_name="Статус")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок сортировки")
    date = models.DateTimeField(default=timezone.now, verbose_name="Дата создания")

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Баннеры"
        verbose_name = "Баннер"

    def __str__(self):
        return self.title or f"Banner {self.pk or 'New'}"
