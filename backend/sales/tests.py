from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from inventory.models import Product, StockMovement
from sales.models import Sale

class SalesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='salesrep', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.product = Product.objects.create(
            name='Ergonomic Keyboard',
            sku='TECH-KB-001',
            unit_price=Decimal('79.99'),
            cost_price=Decimal('40.00'),
            current_stock=10,
            reorder_level=5,
            safety_stock=2
        )

    def test_sales_recording_deducts_stock(self):
        sale_data = {
            'product': self.product.id,
            'quantity': 3,
            'unit_price': '79.99',
            'customer_name': 'Alice Johnson',
            'channel': 'ONLINE'
        }
        res = self.client.post('/api/sales/', sale_data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, 7)

        # Verify stock movement record created
        movement = StockMovement.objects.filter(product=self.product, movement_type='SALE').first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity, -3)
        self.assertEqual(movement.previous_stock, 10)
        self.assertEqual(movement.new_stock, 7)

    def test_prevent_overselling_beyond_stock(self):
        sale_data = {
            'product': self.product.id,
            'quantity': 15,  # Product only has 10 units
            'unit_price': '79.99',
            'customer_name': 'Overbuyer'
        }
        res = self.client.post('/api/sales/', sale_data)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Stock should remain untouched
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, 10)

    def test_sales_analytics(self):
        # Create a sale
        Sale.objects.create(
            invoice_number='INV-TEST-001',
            product=self.product,
            quantity=2,
            unit_price=self.product.unit_price,
            total_price=self.product.unit_price * 2,
            customer_name='Bob'
        )

        res = self.client.get('/api/sales/analytics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_units_sold'], 2)
        self.assertGreater(res.data['total_revenue'], 0)
