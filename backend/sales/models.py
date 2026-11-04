from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from inventory.models import Product

class Sale(models.Model):
    CHANNEL_CHOICES = (
        ('IN_STORE', 'In-Store POS'),
        ('ONLINE', 'E-Commerce Website'),
        ('WHOLESALE', 'Wholesale Partner'),
        ('B2B', 'Corporate B2B'),
    )
    invoice_number = models.CharField(max_length=60, unique=True, db_index=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sales')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    sale_date = models.DateField(default=timezone.localdate, db_index=True)
    customer_name = models.CharField(max_length=150, blank=True, default='Walk-in Customer')
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='IN_STORE')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-sale_date', '-created_at']

    def __str__(self):
        return f"{self.invoice_number} - {self.product.name} ({self.quantity} pcs)"

    def save(self, *args, **kwargs):
        if not self.total_price:
            self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)
