# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0023_productvariant_product_brand_product_in_stock_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='season',
            field=models.CharField(blank=True, db_index=True, help_text='Например: Зима, Лето, Демисезон', max_length=50, null=True, verbose_name='Сезон'),
        ),
        migrations.AddField(
            model_name='product',
            name='material',
            field=models.CharField(blank=True, db_index=True, help_text='Например: Кожа, Текстиль, Резина', max_length=100, null=True, verbose_name='Материал'),
        ),
    ]

