from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


USER_TYPE = (
    ("Vendor", "Продавец"),
    ("Customer", "Покупатель"),
)

class User(AbstractUser):
    username = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        email_username, _ = self.email.split('@')
        if self.username == "" or self.username == None:
             self.username = email_username
        super(User, self).save(*args, **kwargs)
    

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='accounts/users', default='default/default-user.jpg', null=True, blank=True)
    full_name = models.CharField(max_length=255, null=True, blank=True)
    mobile = models.CharField(max_length=255, null=True, blank=True)
    user_type = models.CharField(max_length=255, choices=USER_TYPE, null=True, blank=True, default=None)

    class Meta:
        ordering = ['-id']
        verbose_name_plural = "Профили"

    def __str__(self):
        return self.user.username
    
    def save(self, *args, **kwargs):
        if self.full_name == "" or self.full_name == None:
            # Формируем полное имя из first_name и last_name, или используем username/email
            full_name_parts = []
            if self.user.first_name:
                full_name_parts.append(self.user.first_name)
            if self.user.last_name:
                full_name_parts.append(self.user.last_name)
            
            if full_name_parts:
                self.full_name = ' '.join(full_name_parts)
            else:
                self.full_name = self.user.username or self.user.email.split('@')[0]
        super(Profile, self).save(*args, **kwargs)

    

class ContactMessage(models.Model):
    full_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    subject = models.CharField(max_length=255, null=True, blank=True)
    message = models.TextField(null=True, blank=True)
    date = models.DateTimeField(default=timezone.now)
    def __str__(self):
        return self.full_name

    
    class Meta:
        ordering = ['-date']
        verbose_name_plural = "Сообщение или Обращение"
    