from rest_framework import serializers
from django.db import transaction
from .models import Category, Product, StockMovement

class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(source='products.count', read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'product_count', 'created_at']

class StockMovementSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_sku', 'movement_type',
            'quantity', 'previous_stock', 'new_stock', 'reference', 'reason',
            'created_by', 'created_by_username', 'created_at'
        ]
        read_only_fields = ['previous_stock', 'new_stock', 'created_at']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    stock_status = serializers.CharField(read_only=True)
    total_units_sold = serializers.SerializerMethodField()

    def get_total_units_sold(self, obj):
        if hasattr(obj, 'annotated_units_sold'):
            return obj.annotated_units_sold
        return obj.total_units_sold

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'category', 'category_name', 'description',
            'unit_price', 'cost_price', 'current_stock', 'reorder_level',
            'safety_stock', 'lead_time_days', 'image_url', 'stock_status',
            'total_units_sold', 'created_at', 'updated_at'
        ]

    def validate_sku(self, value):
        instance = getattr(self, 'instance', None)
        qs = Product.objects.filter(sku__iexact=value)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"Product with SKU '{value}' already exists.")
        return value.upper().strip()

    def validate_current_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Current stock cannot be negative.")
        return value

    def create(self, validated_data):
        initial_stock = validated_data.get('current_stock', 0)
        product = super().create(validated_data)
        if initial_stock > 0:
            request = self.context.get('request')
            user = request.user if request and request.user.is_authenticated else None
            StockMovement.objects.create(
                product=product,
                movement_type='IN',
                quantity=initial_stock,
                previous_stock=0,
                new_stock=initial_stock,
                reference='Initial Inventory Creation',
                reason='Initial product stock setup',
                created_by=user
            )
        return product

class StockAdjustmentSerializer(serializers.Serializer):
    movement_type = serializers.ChoiceField(choices=['IN', 'OUT', 'ADJUSTMENT'])
    quantity = serializers.IntegerField()
    reason = serializers.CharField(required=True, min_length=3)
    reference = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be a positive integer.")
        return value

    def adjust(self, product, user=None):
        movement_type = self.validated_data['movement_type']
        qty = self.validated_data['quantity']
        reason = self.validated_data['reason']
        reference = self.validated_data.get('reference', 'Manual Stock Adjustment')

        with transaction.atomic():
            product.refresh_from_db()
            previous_stock = product.current_stock

            if movement_type == 'IN':
                new_stock = previous_stock + qty
                delta = qty
            elif movement_type == 'OUT':
                if previous_stock < qty:
                    raise serializers.ValidationError({"quantity": f"Cannot deduct {qty} units. Only {previous_stock} units in stock."})
                new_stock = previous_stock - qty
                delta = -qty
            elif movement_type == 'ADJUSTMENT':
                # Set direct stock to qty
                new_stock = qty
                delta = new_stock - previous_stock

            product.current_stock = new_stock
            product.save(update_fields=['current_stock', 'updated_at'])

            movement = StockMovement.objects.create(
                product=product,
                movement_type=movement_type,
                quantity=delta,
                previous_stock=previous_stock,
                new_stock=new_stock,
                reference=reference,
                reason=reason,
                created_by=user
            )
            return movement
