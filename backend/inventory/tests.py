from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from .models import Product, Category, StockMovement

class InventoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testmgr', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name='Hardware', description='Tools and hardware')
        self.product = Product.objects.create(
            name='Cordless Drill Pro',
            sku='TOOL-CD-001',
            category=self.category,
            unit_price=Decimal('89.99'),
            cost_price=Decimal('45.00'),
            current_stock=20,
            reorder_level=10,
            safety_stock=5,
            lead_time_days=7
        )

    def test_product_crud(self):
        # List products
        res = self.client.get('/api/products/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Create product
        new_prod_data = {
            'name': 'Impact Driver',
            'sku': 'TOOL-ID-002',
            'category': self.category.id,
            'unit_price': '119.50',
            'cost_price': '60.00',
            'current_stock': 15,
            'reorder_level': 8,
            'safety_stock': 4,
            'lead_time_days': 5
        }
        create_res = self.client.post('/api/products/', new_prod_data)
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_res.data['sku'], 'TOOL-ID-002')

        # Retrieve product
        prod_id = create_res.data['id']
        get_res = self.client.get(f'/api/products/{prod_id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data['name'], 'Impact Driver')

        # Update product
        update_res = self.client.put(f'/api/products/{prod_id}/', {
            **new_prod_data,
            'unit_price': '129.99'
        })
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(float(update_res.data['unit_price']), 129.99)

        # Delete product
        del_res = self.client.delete(f'/api/products/{prod_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_sku_uniqueness(self):
        # Attempt duplicate SKU
        duplicate_data = {
            'name': 'Different Name',
            'sku': 'TOOL-CD-001',  # Same SKU
            'unit_price': '50.00',
            'current_stock': 5
        }
        res = self.client.post('/api/products/', duplicate_data)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sku', res.data)

    def test_stock_adjustments(self):
        # Inward stock adjustment
        adj_data = {
            'movement_type': 'IN',
            'quantity': 10,
            'reason': 'Supplier restock shipment received'
        }
        res = self.client.post(f'/api/products/{self.product.id}/adjust-stock/', adj_data)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, 30)

        # Outward stock adjustment
        out_data = {
            'movement_type': 'OUT',
            'quantity': 5,
            'reason': 'Damaged in warehouse'
        }
        res_out = self.client.post(f'/api/products/{self.product.id}/adjust-stock/', out_data)
        self.assertEqual(res_out.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, 25)

        # Outward exceeding stock should fail
        excess_data = {
            'movement_type': 'OUT',
            'quantity': 999,
            'reason': 'Trying to drain more than available'
        }
        res_excess = self.client.post(f'/api/products/{self.product.id}/adjust-stock/', excess_data)
        self.assertEqual(res_excess.status_code, status.HTTP_400_BAD_REQUEST)


class CsvImportTests(TestCase):
    """Comprehensive CSV import tests covering header mapping, SKU handling, and idempotency."""

    def setUp(self):
        self.user = User.objects.create_user(username='csvtester', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = '/api/products/import-csv/'

        # Pre-existing product to test update vs duplicate logic
        self.category = Category.objects.create(name='Electronics')
        self.existing = Product.objects.create(
            name='Existing Widget',
            sku='ELEC-001',
            category=self.category,
            unit_price=Decimal('29.99'),
            cost_price=Decimal('15.00'),
            current_stock=50,
            reorder_level=10,
            safety_stock=5,
            lead_time_days=3,
        )

    def _upload(self, csv_text):
        """Helper: upload a CSV string and return the response."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        f = SimpleUploadedFile('test.csv', csv_text.encode('utf-8'), content_type='text/csv')
        return self.client.post(self.url, {'file': f}, format='multipart')

    # ── 1. Standard 'SKU' column header ──────────────────────────────────
    def test_import_with_standard_sku_header(self):
        csv = "SKU,Name,Unit Price,Current Stock\nNEW-001,Test Product,19.99,10\n"
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 1)
        self.assertTrue(Product.objects.filter(sku='NEW-001').exists())

    # ── 2. 'Product SKU' alternative header ──────────────────────────────
    def test_import_with_product_sku_header(self):
        csv = "Product SKU,Name,Unit Price\nALT-001,Alt Product,9.99\n"
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 1)
        self.assertTrue(Product.objects.filter(sku='ALT-001').exists())

    # ── 3. 'product_sku' (underscore, lowercase) alternative header ──────
    def test_import_with_product_underscore_sku_header(self):
        csv = "product_sku,Name,Unit Price\nUND-001,Underscore Product,5.50\n"
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 1)
        self.assertTrue(Product.objects.filter(sku='UND-001').exists())

    # ── 4. Blank SKU values produce row-level errors ─────────────────────
    def test_import_blank_sku_values(self):
        csv = "SKU,Name,Unit Price\n,Blank SKU Product,10.00\nVALID-001,Valid Product,20.00\n"
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 1)  # Only the valid row
        self.assertEqual(res.data['error_count'], 1)     # Blank row has error
        self.assertTrue(Product.objects.filter(sku='VALID-001').exists())

    # ── 5. Existing SKU → update (not duplicate) ────────────────────────
    def test_import_existing_sku_updates(self):
        csv = "SKU,Name,Unit Price,Current Stock\nELEC-001,Updated Widget,39.99,100\n"
        count_before = Product.objects.count()
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 0)
        self.assertEqual(res.data['updated_count'], 1)
        # No duplicate created
        self.assertEqual(Product.objects.count(), count_before)
        self.existing.refresh_from_db()
        self.assertEqual(self.existing.name, 'Updated Widget')
        self.assertEqual(self.existing.unit_price, Decimal('39.99'))
        self.assertEqual(self.existing.current_stock, 100)

    # ── 6. New SKU → create ──────────────────────────────────────────────
    def test_import_new_sku_creates(self):
        csv = "SKU,Name,Unit Price\nBRAND-NEW-001,Brand New Item,99.99\n"
        count_before = Product.objects.count()
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 1)
        self.assertEqual(Product.objects.count(), count_before + 1)

    # ── 7. Re-import same CSV → idempotent (0 created, N updated) ───────
    def test_reimport_same_csv_no_duplicates(self):
        csv = "SKU,Name,Unit Price,Current Stock\nIDEM-001,Idempotent Item,15.00,25\n"
        # First import
        res1 = self._upload(csv)
        self.assertEqual(res1.data['created_count'], 1)
        count_after_first = Product.objects.count()

        # Second import — same data
        res2 = self._upload(csv)
        self.assertEqual(res2.data['created_count'], 0)
        self.assertEqual(res2.data['updated_count'], 1)
        self.assertEqual(Product.objects.count(), count_after_first)

    # ── 8. No SKU column at all → 400 error ──────────────────────────────
    def test_import_no_sku_column_returns_400(self):
        csv = "Name,Unit Price\nOrphan Product,12.00\n"
        res = self._upload(csv)
        self.assertEqual(res.status_code, 400)
        self.assertIn('No SKU column', res.data.get('error', ''))

    # ── 9. Case-insensitive SKU matching ─────────────────────────────────
    def test_import_case_insensitive_sku_match(self):
        """Lowercase CSV SKU should match existing uppercase DB SKU (update, not duplicate)."""
        csv = "SKU,Name,Unit Price\nelec-001,Updated Via Lowercase,49.99\n"
        count_before = Product.objects.count()
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 0)
        self.assertEqual(res.data['updated_count'], 1)
        self.assertEqual(Product.objects.count(), count_before)
        self.existing.refresh_from_db()
        self.assertEqual(self.existing.sku, 'ELEC-001')  # Still uppercase

    # ── 10. Mixed new + existing + blank rows ────────────────────────────
    def test_import_mixed_rows(self):
        csv = (
            "SKU,Name,Unit Price,Current Stock\n"
            "ELEC-001,Updated Existing,29.99,50\n"   # update
            "MIX-NEW-001,Brand New,10.00,5\n"         # create
            ",Missing SKU,5.00,1\n"                   # error (blank)
            "MIX-NEW-002,Another New,8.00,3\n"        # create
        )
        res = self._upload(csv)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['created_count'], 2)
        self.assertEqual(res.data['updated_count'], 1)
        self.assertEqual(res.data['error_count'], 1)
