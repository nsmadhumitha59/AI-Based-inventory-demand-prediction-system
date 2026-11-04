import random
from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction

from accounts.models import UserProfile
from inventory.models import Category, Product, StockMovement
from suppliers.models import Supplier, SupplierProduct
from sales.models import Sale
from forecasting.ml_engine import DemandForecastEngine

class Command(BaseCommand):
    help = 'Populates the database with realistic sample data for testing and demonstrations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing products, sales, suppliers, and forecast runs before seeding',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting StockWise AI Sample Data Population..."))

        if options['clear']:
            self.stdout.write("Clearing existing sample records...")
            Sale.objects.all().delete()
            StockMovement.objects.all().delete()
            SupplierProduct.objects.all().delete()
            Supplier.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()

        # 1. Create Demo Admin User
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@stockwise.ai',
                'first_name': 'Sarah',
                'last_name': 'Conner',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created or not admin_user.has_usable_password():
            admin_user.set_password('admin1234')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created demo superuser: admin / admin1234"))

        # 2. Categories
        categories_data = [
            ("Electronics & Smart Devices", "High-demand smart gadgets, accessories, and computing peripherals"),
            ("Industrial & Tools", "Heavy-duty parts, pneumatic valves, electrical switches, and hardware"),
            ("Office & Ergonomics", "Standing desks, ergonomic chairs, monitor arms, and desk accessories"),
            ("Health & Wellness", "Fitness trackers, air purifiers, ergonomic massagers, and vitamins"),
            ("Home Appliances", "Smart kitchen appliances, robot vacuums, and climate control devices"),
        ]

        categories = {}
        for cat_name, desc in categories_data:
            cat, _ = Category.objects.get_or_create(name=cat_name, defaults={'description': desc})
            categories[cat_name] = cat

        # 3. Suppliers
        suppliers_data = [
            {
                "name": "Apex Global Electronics Ltd",
                "contact_person": "Michael Chang",
                "email": "mchang@apexlogistics.com",
                "phone": "+1 (555) 234-5678",
                "address": "450 Industrial Parkway, Fremont, CA",
                "lead_time_days": 7,
            },
            {
                "name": "Vortex Heavy Components Inc",
                "contact_person": "Elena Rostova",
                "email": "erostova@vortextools.de",
                "phone": "+49 89 1234 567",
                "address": "Kaiserstraße 12, Munich, Germany",
                "lead_time_days": 12,
            },
            {
                "name": "ErgoPro Nordic Systems",
                "contact_person": "Lars Lindqvist",
                "email": "lars@ergonordic.se",
                "phone": "+46 8 987 654",
                "address": "Sveavägen 88, Stockholm, Sweden",
                "lead_time_days": 10,
            },
            {
                "name": "NovaLife Wellness Co",
                "contact_person": "Priya Sharma",
                "email": "psharma@novalife.io",
                "phone": "+1 (555) 876-5432",
                "address": "120 Boulder Ridge Blvd, Austin, TX",
                "lead_time_days": 5,
            },
        ]

        suppliers = []
        for s_data in suppliers_data:
            supplier, _ = Supplier.objects.get_or_create(
                name=s_data['name'],
                defaults=s_data
            )
            suppliers.append(supplier)

        # 4. Products Specification
        # Carefully crafted with diverse stock scenarios:
        # - High volume, continuous data (>60 days sales, healthy stock)
        # - High volume, low stock (critical reorder needed!)
        # - Heavy overstocked
        # - Out of stock (0 stock)
        # - Brand new item (sparse data, tests baseline fallback)
        products_spec = [
            {
                "sku": "TECH-ANC-880",
                "name": "UltraComfort ANC Wireless Headphones",
                "category": categories["Electronics & Smart Devices"],
                "unit_price": Decimal("149.99"),
                "cost_price": Decimal("85.00"),
                "current_stock": 18,  # Near reorder level!
                "reorder_level": 25,
                "safety_stock": 10,
                "lead_time_days": 7,
                "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
                "sales_profile": "high_steady",  # 4-8 units/day for 75 days
                "supplier": suppliers[0],
            },
            {
                "sku": "TECH-DOCK-4K",
                "name": "Thunderbolt 4 Pro Triple-Display Dock",
                "category": categories["Electronics & Smart Devices"],
                "unit_price": Decimal("229.50"),
                "cost_price": Decimal("140.00"),
                "current_stock": 85,
                "reorder_level": 20,
                "safety_stock": 8,
                "lead_time_days": 8,
                "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
                "sales_profile": "moderate",  # 2-5 units/day for 65 days
                "supplier": suppliers[0],
            },
            {
                "sku": "IND-VALV-X5",
                "name": "Precision Stainless Pneumatic Control Valve",
                "category": categories["Industrial & Tools"],
                "unit_price": Decimal("310.00"),
                "cost_price": Decimal("195.00"),
                "current_stock": 4,  # LOW STOCK
                "reorder_level": 15,
                "safety_stock": 5,
                "lead_time_days": 12,
                "image_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400",
                "sales_profile": "b2b_spikes",  # industrial orders
                "supplier": suppliers[1],
            },
            {
                "sku": "OFF-CHAIR-PRO",
                "name": "ErgoMesh Lumbar Task Chair Elite",
                "category": categories["Office & Ergonomics"],
                "unit_price": Decimal("389.00"),
                "cost_price": Decimal("210.00"),
                "current_stock": 0,  # OUT OF STOCK!
                "reorder_level": 12,
                "safety_stock": 6,
                "lead_time_days": 10,
                "image_url": "https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=400",
                "sales_profile": "high_steady",
                "supplier": suppliers[2],
            },
            {
                "sku": "OFF-DESK-MOT",
                "name": "Dual-Motor Electric Standing Desk 60x30",
                "category": categories["Office & Ergonomics"],
                "unit_price": Decimal("499.00"),
                "cost_price": Decimal("310.00"),
                "current_stock": 35,
                "reorder_level": 15,
                "safety_stock": 5,
                "lead_time_days": 10,
                "image_url": "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400",
                "sales_profile": "moderate",
                "supplier": suppliers[2],
            },
            {
                "sku": "HLTH-PUR-MAX",
                "name": "HEPA-13 Plasma Air Purifier 500sqft",
                "category": categories["Health & Wellness"],
                "unit_price": Decimal("189.00"),
                "cost_price": Decimal("110.00"),
                "current_stock": 240,  # OVERSTOCKED
                "reorder_level": 20,
                "safety_stock": 8,
                "lead_time_days": 5,
                "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400",
                "sales_profile": "moderate",
                "supplier": suppliers[3],
            },
            {
                "sku": "HOME-ROBO-VAC",
                "name": "Lidar Smart Robot Vacuum & Auto-Mop",
                "category": categories["Home Appliances"],
                "unit_price": Decimal("449.00"),
                "cost_price": Decimal("280.00"),
                "current_stock": 42,
                "reorder_level": 18,
                "safety_stock": 7,
                "lead_time_days": 9,
                "image_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400",
                "sales_profile": "weekend_surge",  # higher sales on Sat/Sun
                "supplier": suppliers[0],
            },
            {
                "sku": "TECH-NEW-SMART",
                "name": "Smart Ambient Glow Sunrise Lamp (New)",
                "category": categories["Electronics & Smart Devices"],
                "unit_price": Decimal("79.99"),
                "cost_price": Decimal("42.00"),
                "current_stock": 50,
                "reorder_level": 15,
                "safety_stock": 5,
                "lead_time_days": 7,
                "image_url": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400",
                "sales_profile": "sparse_baseline",  # ONLY 5 days of sales!
                "supplier": suppliers[0],
            },
        ]

        products = []
        for p_spec in products_spec:
            product, _ = Product.objects.get_or_create(
                sku=p_spec['sku'],
                defaults={
                    'name': p_spec['name'],
                    'category': p_spec['category'],
                    'unit_price': p_spec['unit_price'],
                    'cost_price': p_spec['cost_price'],
                    'current_stock': p_spec['current_stock'],
                    'reorder_level': p_spec['reorder_level'],
                    'safety_stock': p_spec['safety_stock'],
                    'lead_time_days': p_spec['lead_time_days'],
                    'image_url': p_spec['image_url'],
                }
            )
            products.append((product, p_spec))

            # Associate supplier
            SupplierProduct.objects.get_or_create(
                supplier=p_spec['supplier'],
                product=product,
                defaults={
                    'supplier_sku': f"SUP-{p_spec['sku']}",
                    'supply_price': p_spec['cost_price'],
                    'lead_time_days': p_spec['lead_time_days'],
                    'is_primary': True
                }
            )

        # 5. Generate Historical Sales & Stock Movements
        today = timezone.now().date()
        random.seed(42)

        customers = [
            "Apex Logistics Corp", "TechWave Solutions", "OmniGlobal Enterprises",
            "Nordic Design Studios", "Metro Retailers", "David Miller",
            "Jennifer Lawrence", "Carlos Rodriguez", "Amina Patel", "Lucas Silva"
        ]
        channels = ['IN_STORE', 'ONLINE', 'WHOLESALE', 'B2B']

        total_sales_created = 0

        with transaction.atomic():
            for product, spec in products:
                profile = spec['sales_profile']
                # Initial Stock In movement
                StockMovement.objects.get_or_create(
                    product=product,
                    reference="INITIAL-PO-001",
                    defaults={
                        'movement_type': 'IN',
                        'quantity': product.current_stock + 200,
                        'previous_stock': 0,
                        'new_stock': product.current_stock + 200,
                        'reason': 'Initial warehouse purchase order delivery',
                        'created_by': admin_user
                    }
                )

                if profile == 'sparse_baseline':
                    # Only 5 sales records in the last 10 days
                    sale_days = [2, 4, 5, 8, 9]
                    for day_ago in sale_days:
                        s_date = today - timedelta(days=day_ago)
                        qty = random.randint(1, 3)
                        invoice_num = f"INV-{s_date.strftime('%Y%m%d')}-{product.sku[:4]}-{random.randint(100, 999)}"
                        Sale.objects.get_or_create(
                            invoice_number=invoice_num,
                            defaults={
                                'product': product,
                                'quantity': qty,
                                'unit_price': product.unit_price,
                                'total_price': product.unit_price * qty,
                                'sale_date': s_date,
                                'customer_name': random.choice(customers),
                                'channel': random.choice(channels),
                                'created_by': admin_user
                            }
                        )
                        total_sales_created += 1
                    continue

                # For products with rich history (60 to 75 days)
                num_days = 75 if profile == 'high_steady' else 60
                for d in range(num_days, 0, -1):
                    sale_date = today - timedelta(days=d)
                    is_weekend = sale_date.weekday() in (5, 6)

                    # Determine daily volume based on profile
                    if profile == 'high_steady':
                        base_qty = random.randint(4, 9) + (3 if is_weekend else 0)
                    elif profile == 'moderate':
                        base_qty = random.randint(2, 5) + (1 if is_weekend else 0)
                    elif profile == 'weekend_surge':
                        base_qty = random.randint(5, 11) if is_weekend else random.randint(1, 4)
                    elif profile == 'b2b_spikes':
                        # B2B orders: many days 0-1, occasional batch order of 5-10
                        base_qty = random.choice([0, 0, 1, 0, 6, 0, 1, 8])

                    if base_qty > 0:
                        invoice_num = f"INV-{sale_date.strftime('%Y%m%d')}-{product.sku[:4]}-{random.randint(100, 999)}"
                        Sale.objects.get_or_create(
                            invoice_number=invoice_num,
                            defaults={
                                'product': product,
                                'quantity': base_qty,
                                'unit_price': product.unit_price,
                                'total_price': product.unit_price * base_qty,
                                'sale_date': sale_date,
                                'customer_name': random.choice(customers),
                                'channel': random.choice(channels),
                                'created_by': admin_user
                            }
                        )
                        total_sales_created += 1

        self.stdout.write(self.style.SUCCESS(f"Generated {total_sales_created} historical sales records."))

        # 6. Run Forecasting Pipeline for Key Products to Pre-populate Dashboard and Forecast tabs
        self.stdout.write("Running AI Demand Forecasting on products...")
        for product, spec in products:
            try:
                engine = DemandForecastEngine(product=product, horizon_days=30)
                run, rec = engine.run_forecast()
                self.stdout.write(f" -> Forecasted {product.name}: Model={run.model_name}, Reorder Priority={rec.priority}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error forecasting {product.name}: {e}"))

        self.stdout.write(self.style.SUCCESS("StockWise AI Sample Data setup completed successfully!"))
        self.stdout.write(self.style.SUCCESS("Superuser: admin / admin1234"))
