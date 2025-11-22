from django.db import models
from userauths import models as userauths_models
from django.utils.text import slugify
from django_ckeditor_5.fields import CKEditor5Field
from django.utils import timezone

STATUS_CHOICES = [
    ('Draft', 'Черновик'),
    ('Published', 'Опубликовано'),
]


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Название")
    slug = models.SlugField(max_length=150, unique=True, blank=True, verbose_name="URL")

    class Meta:
        ordering = ['-id']
        verbose_name = "Категория блога"
        verbose_name_plural = "Категории блога"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Blog(models.Model):
    image = models.ImageField(upload_to='blog_images', blank=True, null=True, verbose_name="Изображение")
    title = models.CharField(max_length=200, verbose_name="Заголовок")
    slug = models.SlugField(max_length=350, unique=True, blank=True, verbose_name="URL")
    author = models.ForeignKey(userauths_models.User, on_delete=models.CASCADE, verbose_name="Автор")
    content = CKEditor5Field(config_name='extends', null=True, blank=True, verbose_name="Содержание")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, verbose_name="Категория")
    tags = models.CharField(max_length=200, null=True, blank=True, verbose_name="Теги")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="Published", verbose_name="Статус")
    likes = models.ManyToManyField(userauths_models.User, blank=True, related_name="likes", verbose_name="Лайки")
    views = models.PositiveIntegerField(default=0, verbose_name="Просмотры")
    is_featured = models.BooleanField(default=False, verbose_name="Рекомендуемое")
    date = models.DateTimeField(auto_now=True, verbose_name="Дата")

    class Meta:
        ordering = ['-id']
        verbose_name = "Блог"
        verbose_name_plural = "Блоги"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    def total_likes(self):
        return self.likes.all().count()


class Comment(models.Model):
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name="comments", verbose_name="Блог")
    full_name = models.CharField(max_length=100, null=True, blank=True, verbose_name="Полное имя")
    email = models.EmailField(null=True, blank=True, verbose_name="Email")
    content = models.TextField(null=True, blank=True, verbose_name="Содержание")
    approved = models.BooleanField(default=False, verbose_name="Одобрено")
    date = models.DateTimeField(default=timezone.now, verbose_name="Дата")

    class Meta:
        ordering = ['-id']
        verbose_name = "Комментарий"
        verbose_name_plural = "Комментарии"

    def __str__(self):
        return f"Комментарий от {self.full_name} к статье {self.blog.title}"
