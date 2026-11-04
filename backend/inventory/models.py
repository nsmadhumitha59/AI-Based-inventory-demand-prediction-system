from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    sku = models.CharField(max_length=60, unique=True, db_index=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    description = models.TextField(blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_stock = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=15)
    safety_stock = models.IntegerField(default=5)
    lead_time_days = models.IntegerField(default=7)
    image_url = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def stock_status(self):
        if self.current_stock <= 0:
            return 'OUT_OF_STOCK'
        elif self.current_stock <= self.reorder_level:
            return 'LOW_STOCK'
        elif self.current_stock > max(self.reorder_level * 4, 100):
            return 'OVERSTOCKED'
        return 'IN_STOCK'

    @property
    def total_units_sold(self):
        return self.sales.aggregate(total=models.Sum('quantity'))['total'] or 0

class StockMovement(models.Model):
    MOVEMENT_CHOICES = (
        ('IN', 'Stock In (Purchase/Restock)'),
        ('OUT', 'Stock Out (Waste/Damaged)'),
        ('ADJUSTMENT', 'Manual Adjustment'),
        ('SALE', 'Sale Deduction'),
        ('RETURN', 'Customer Return'),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_CHOICES)
    quantity = models.IntegerField()  # positive or negative delta
    previous_stock = models.IntegerField()
    new_stock = models.IntegerField()
    reference = models.CharField(max_length=100, blank=True)
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.sku} - {self.movement_type}: {self.quantity} on {self.created_at.strftime('%Y-%m-%d')}"
