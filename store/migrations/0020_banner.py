# Generated manually for Banner model

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0019_alter_orderitem_options'),
    ]

    operations = [
        migrations.CreateModel(
            name='Banner',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('banner_type', models.CharField(choices=[('main', 'Главный баннер'), ('small', 'Малый баннер')], default='main', max_length=10, verbose_name='Тип баннера')),
                ('title', models.CharField(max_length=200, verbose_name='Заголовок')),
                ('text', models.TextField(blank=True, null=True, verbose_name='Текст')),
                ('button_text', models.CharField(blank=True, max_length=100, null=True, verbose_name='Текст кнопки')),
                ('button_link', models.CharField(blank=True, max_length=500, null=True, verbose_name='Ссылка кнопки')),
                ('image', models.ImageField(blank=True, null=True, upload_to='banners', verbose_name='Изображение')),
                ('background_color', models.CharField(default='#FF0000', max_length=100, verbose_name='Цвет фона')),
                ('status', models.CharField(choices=[('Published', 'Published'), ('Draft', 'Draft'), ('Disabled', 'Disabled')], default='Published', max_length=50, verbose_name='Статус')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Порядок сортировки')),
                ('date', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Дата создания')),
            ],
            options={
                'verbose_name': 'Баннер',
                'verbose_name_plural': 'Баннеры',
                'ordering': ['-id'],
            },
        ),
    ]

