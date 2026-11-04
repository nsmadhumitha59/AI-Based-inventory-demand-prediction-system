import uuid
from decimal import Decimal
from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Sale
from inventory.models import Product, StockMovement

class SaleSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    invoice_number = serializers.CharField(required=False)

    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_number', 'product', 'product_name', 'product_sku',
            'quantity', 'unit_price', 'total_price', 'sale_date', 'customer_name',
            'channel', 'notes', 'created_by', 'created_by_username', 'created_at'
        ]
        read_only_fields = ['total_price', 'created_at']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def create(self, validated_data):
        product = validated_data['product']
        quantity = validated_data['quantity']
        unit_price = validated_data.get('unit_price', product.unit_price)

        if not validated_data.get('invoice_number'):
            validated_data['invoice_number'] = f"INV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        validated_data['unit_price'] = unit_price
        validated_data['total_price'] = Decimal(str(unit_price)) * quantity

        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        if user:
            validated_data['created_by'] = user

        with transaction.atomic():
            # Lock product row to prevent race conditions in concurrent sales
            locked_product = Product.objects.select_for_update().get(id=product.id)
            if locked_product.current_stock < quantity:
                raise serializers.ValidationError({
                    "quantity": f"Insufficient stock. Available stock for {locked_product.name} is {locked_product.current_stock} units."
                })

            previous_stock = locked_product.current_stock
            new_stock = previous_stock - quantity
            locked_product.current_stock = new_stock
            locked_product.save(update_fields=['current_stock', 'updated_at'])

            sale = Sale.objects.create(**validated_data)

            StockMovement.objects.create(
                product=locked_product,
                movement_type='SALE',
                quantity=-quantity,
                previous_stock=previous_stock,
                new_stock=new_stock,
                reference=sale.invoice_number,
                reason=f"Sale transaction #{sale.invoice_number} ({sale.customer_name})",
                created_by=user
            )

            return sale
