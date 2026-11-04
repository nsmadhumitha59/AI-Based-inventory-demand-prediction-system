from rest_framework import serializers
from .models import Supplier, SupplierProduct
from inventory.serializers import ProductSerializer

class SupplierProductSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = SupplierProduct
        fields = [
            'id', 'supplier', 'product', 'product_name', 'product_sku',
            'supplier_sku', 'supply_price', 'lead_time_days', 'is_primary', 'created_at'
        ]

class SupplierSerializer(serializers.ModelSerializer):
    supplied_products = SupplierProductSerializer(many=True, read_only=True)
    products_count = serializers.IntegerField(source='supplied_products.count', read_only=True)

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_person', 'email', 'phone',
            'address', 'lead_time_days', 'status', 'products_count',
            'supplied_products', 'created_at', 'updated_at'
        ]
