from rest_framework import serializers
from .models import ForecastRun, ForecastResult, ReorderRecommendation
from inventory.models import Product

class ForecastResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastResult
        fields = ['id', 'date', 'predicted_quantity', 'lower_bound', 'upper_bound']

class ForecastRunSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    current_stock = serializers.IntegerField(source='product.current_stock', read_only=True)
    results = ForecastResultSerializer(many=True, read_only=True)

    class Meta:
        model = ForecastRun
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'current_stock',
            'horizon_days', 'model_name', 'evaluation_metrics', 'is_sufficient_data',
            'notes', 'results', 'created_at'
        ]

class ReorderRecommendationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True)
    lead_time_days = serializers.IntegerField(source='product.lead_time_days', read_only=True)

    class Meta:
        model = ReorderRecommendation
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'category_name',
            'lead_time_days', 'forecast_run', 'current_stock',
            'forecasted_demand_lead_time', 'safety_stock', 'reorder_level',
            'recommended_reorder_qty', 'estimated_stockout_date', 'priority',
            'status', 'reasoning', 'created_at', 'reviewed_at'
        ]

class GenerateForecastInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    horizon_days = serializers.ChoiceField(choices=[7, 30, 90], default=30)

    def validate_product_id(self, value):
        if not Product.objects.filter(id=value).exists():
            raise serializers.ValidationError(f"Product with ID {value} does not exist.")
        return value
