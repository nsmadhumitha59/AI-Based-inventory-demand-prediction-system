from django.db import models
from inventory.models import Product

class ForecastRun(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='forecast_runs')
    horizon_days = models.IntegerField(default=30)
    model_name = models.CharField(max_length=100)
    evaluation_metrics = models.JSONField(default=dict)
    is_sufficient_data = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.product.name} - {self.model_name} ({self.horizon_days}d) at {self.created_at.strftime('%Y-%m-%d %H:%M')}"

class ForecastResult(models.Model):
    forecast_run = models.ForeignKey(ForecastRun, on_delete=models.CASCADE, related_name='results')
    date = models.DateField()
    predicted_quantity = models.FloatField()
    lower_bound = models.FloatField(default=0.0)
    upper_bound = models.FloatField(default=0.0)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"{self.date}: {self.predicted_quantity:.1f} units"

class ReorderRecommendation(models.Model):
    PRIORITY_CHOICES = (
        ('CRITICAL', 'Critical Stockout Risk'),
        ('HIGH', 'High Priority'),
        ('MEDIUM', 'Medium Priority'),
        ('LOW', 'Low Priority'),
        ('OPTIMAL', 'Stock Optimal'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('REVIEWED', 'Reviewed'),
        ('ORDERED', 'Purchase Order Placed'),
        ('DISMISSED', 'Dismissed'),
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reorder_recommendations')
    forecast_run = models.ForeignKey(ForecastRun, on_delete=models.SET_NULL, null=True, blank=True)
    current_stock = models.IntegerField()
    forecasted_demand_lead_time = models.FloatField()
    safety_stock = models.IntegerField()
    reorder_level = models.IntegerField()
    recommended_reorder_qty = models.IntegerField()
    estimated_stockout_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reasoning = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Reorder {self.recommended_reorder_qty} units for {self.product.name} ({self.priority})"
