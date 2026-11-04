from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta
from decimal import Decimal

from inventory.models import Product
from sales.models import Sale
from forecasting.models import ForecastRun, ReorderRecommendation
from forecasting.ml_engine import DemandForecastEngine

class ForecastingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='forecaster', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.product_rich = Product.objects.create(
            name='Smart Watch v2',
            sku='TECH-SW-002',
            unit_price=Decimal('199.99'),
            current_stock=15,
            reorder_level=20,
            safety_stock=5,
            lead_time_days=7
        )

        self.product_sparse = Product.objects.create(
            name='Prototype Sensor',
            sku='PROTO-SNS-01',
            unit_price=Decimal('50.00'),
            current_stock=10,
            reorder_level=5,
            safety_stock=2,
            lead_time_days=7
        )

        # Seed 45 days of sales for product_rich
        today = timezone.now().date()
        for i in range(45, 0, -1):
            s_date = today - timedelta(days=i)
            qty = 3 if s_date.weekday() in (5, 6) else 2
            Sale.objects.create(
                invoice_number=f"INV-RICH-{i}",
                product=self.product_rich,
                quantity=qty,
                unit_price=self.product_rich.unit_price,
                total_price=self.product_rich.unit_price * qty,
                sale_date=s_date
            )

        # Seed only 3 days for product_sparse
        for i in [2, 4, 7]:
            s_date = today - timedelta(days=i)
            Sale.objects.create(
                invoice_number=f"INV-SPARSE-{i}",
                product=self.product_sparse,
                quantity=1,
                unit_price=self.product_sparse.unit_price,
                total_price=self.product_sparse.unit_price * 1,
                sale_date=s_date
            )

    def test_forecast_sufficient_data_ml(self):
        engine = DemandForecastEngine(product=self.product_rich, horizon_days=30)
        run, rec = engine.run_forecast()

        self.assertTrue(run.is_sufficient_data)
        self.assertIn("Random Forest", run.model_name)
        self.assertIn('mae', run.evaluation_metrics)
        self.assertIsNotNone(run.evaluation_metrics['mae'])
        self.assertEqual(run.results.count(), 30)

        # Reorder recommendation should have generated priority
        self.assertIn(rec.priority, ['CRITICAL', 'HIGH', 'MEDIUM', 'OPTIMAL'])
        self.assertGreater(rec.recommended_reorder_qty, 0)

    def test_forecast_insufficient_data_baseline(self):
        engine = DemandForecastEngine(product=self.product_sparse, horizon_days=30)
        run, rec = engine.run_forecast()

        self.assertFalse(run.is_sufficient_data)
        self.assertIn("Baseline", run.model_name)
        self.assertIsNone(run.evaluation_metrics['mae'])
        self.assertIn("insufficient", run.notes.lower())

    def test_api_generate_forecast_endpoint(self):
        payload = {
            'product_id': self.product_rich.id,
            'horizon_days': 30
        }
        res = self.client.post('/api/forecast/generate/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('forecast_run', res.data)
        self.assertIn('recommendation', res.data)
        self.assertIn('historical_sales', res.data)

    def test_unauthenticated_access_denied(self):
        anon_client = APIClient()
        res = anon_client.get('/api/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
