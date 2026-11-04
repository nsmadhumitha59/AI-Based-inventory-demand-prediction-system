import random
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from inventory.models import Category, Product, StockMovement
from suppliers.models import Supplier, SupplierProduct
from sales.models import Sale

class Command(BaseCommand):
    help = 'Ensures exactly 1,200 products exist in the database with realistic inventory data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Checking product count in database..."))

        current_count = Product.objects.count()
        self.stdout.write(f"Current total products in database: {current_count}")

        TARGET_COUNT = 1200

        if current_count == TARGET_COUNT:
            self.stdout.write(self.style.SUCCESS(f"Database already has exactly {TARGET_COUNT} products! Nothing to add."))
            return

        if current_count > TARGET_COUNT:
            self.stdout.write(self.style.WARNING(
                f"Database has {current_count} products (more than {TARGET_COUNT}). "
                f"Per instructions, not deleting any existing data without explicit user request."
            ))
            return

        needed = TARGET_COUNT - current_count
        self.stdout.write(self.style.NOTICE(f"Need to add {needed} products to reach exactly {TARGET_COUNT} products."))

        # Fetch categories
        categories = list(Category.objects.all())
        if not categories:
            self.stdout.write(self.style.ERROR("No categories found. Run seed_sample_data first."))
            return

        cat_map = {c.name: c for c in categories}
        cat_elec = cat_map.get("Electronics & Smart Devices", categories[0])
        cat_ind = cat_map.get("Industrial & Tools", categories[1 % len(categories)])
        cat_off = cat_map.get("Office & Ergonomics", categories[2 % len(categories)])
        cat_hlth = cat_map.get("Health & Wellness", categories[3 % len(categories)])
        cat_home = cat_map.get("Home Appliances", categories[4 % len(categories)])

        # Fetch suppliers
        suppliers = list(Supplier.objects.all())
        sup_apex = suppliers[0] if len(suppliers) > 0 else None
        sup_vortex = suppliers[1] if len(suppliers) > 1 else sup_apex
        sup_ergo = suppliers[2] if len(suppliers) > 2 else sup_apex
        sup_nova = suppliers[3] if len(suppliers) > 3 else sup_apex

        admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()

        # Blueprints per category
        catalog_blueprints = [
            # 1. Electronics & Smart Devices
            {
                "category": cat_elec,
                "prefix": "ELEC",
                "supplier": sup_apex,
                "items": [
                    ("UltraWide Curved Gaming Monitor", "MON", Decimal("329.99"), Decimal("195.00"), "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400"),
                    ("Noise-Cancelling Wireless Over-Ear Headphones", "AUD", Decimal("189.50"), Decimal("95.00"), "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400"),
                    ("Thunderbolt 4 Pro Docking Station", "DCK", Decimal("219.00"), Decimal("130.00"), "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400"),
                    ("Mechanical RGB Gaming Keyboard", "KBD", Decimal("119.00"), Decimal("62.00"), "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400"),
                    ("Precision Ergonomic Wireless Mouse", "MOU", Decimal("69.99"), Decimal("34.00"), "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400"),
                    ("Smart 2K Wi-Fi Indoor Security Camera", "CAM", Decimal("79.99"), Decimal("38.00"), "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400"),
                    ("High-Speed NVMe M.2 SSD Drive", "SSD", Decimal("139.00"), Decimal("78.00"), "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400"),
                    ("Magnetic Fast Wireless Power Bank", "PWR", Decimal("49.99"), Decimal("24.00"), "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?w=400"),
                    ("True Wireless Stereo ANC Earbuds", "EAR", Decimal("89.99"), Decimal("42.00"), "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400"),
                    ("Pro Conference Bluetooth Speakerphone", "SPK", Decimal("129.00"), Decimal("68.00"), "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400"),
                    ("4K 60FPS Pro Streamer Webcam", "WBC", Decimal("149.00"), Decimal("75.00"), "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400"),
                    ("Wi-Fi 6 Tri-Band Mesh Router Node", "NET", Decimal("179.00"), Decimal("98.00"), "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400"),
                    ("100W GaN 4-Port Fast Wall Charger", "CHG", Decimal("59.99"), Decimal("28.00"), "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400"),
                    ("Smart LED Screen Bar Desk Light", "LGT", Decimal("64.99"), Decimal("31.00"), "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400"),
                    ("Biometric Fingerprint Hardware Key", "SEC", Decimal("54.00"), Decimal("26.00"), "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400"),
                    ("Foldable 3-Axis Smartphone Gimbal", "GMB", Decimal("109.00"), Decimal("55.00"), "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=400"),
                    ("Aluminum Dual-Fan Laptop Cooler", "FAN", Decimal("42.50"), Decimal("20.00"), "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400"),
                    ("Digital USB-C Studio Microphone", "MIC", Decimal("119.50"), Decimal("58.00"), "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400"),
                ]
            },
            # 2. Industrial & Tools
            {
                "category": cat_ind,
                "prefix": "IND",
                "supplier": sup_vortex,
                "items": [
                    ("Stainless Pneumatic Control Valve", "VAL", Decimal("295.00"), Decimal("175.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("Brushless 20V Cordless Impact Driver", "DRV", Decimal("185.00"), Decimal("105.00"), "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400"),
                    ("Heavy-Duty Double-Acting Air Cylinder", "CYL", Decimal("210.00"), Decimal("120.00"), "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"),
                    ("Digital Caliper Stainless Steel IP67", "CAL", Decimal("78.50"), Decimal("39.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("High-Pressure Hydraulic Hose Assembly", "HSE", Decimal("125.00"), Decimal("65.00"), "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"),
                    ("Industrial Temperature Transmitter RTD", "TRN", Decimal("245.00"), Decimal("140.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("Bluetooth Laser Distance Measurer 100M", "LSR", Decimal("95.00"), Decimal("48.00"), "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400"),
                    ("Rotary Hammer Drill SDS Plus 900W", "HMR", Decimal("220.00"), Decimal("125.00"), "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400"),
                    ("Precision Dial Indicator Magnetic Stand", "IND", Decimal("88.00"), Decimal("44.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("Air Filter Regulator Lubricator Unit", "FRL", Decimal("135.00"), Decimal("72.00"), "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"),
                    ("Heavy Cast Steel Bench Vise 6-Inch", "VIS", Decimal("165.00"), Decimal("92.00"), "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400"),
                    ("Carbide End Mill CNC Milling Set", "MIL", Decimal("115.00"), Decimal("58.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("Flanged Deep Groove Ball Bearing Steel", "BRG", Decimal("45.00"), Decimal("22.00"), "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"),
                    ("High-Torque Planetary Gear Motor 24V", "MTR", Decimal("175.00"), Decimal("95.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("Non-Contact Infrared Pyrometer 800C", "PYR", Decimal("110.00"), Decimal("55.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                    ("Brass Inline Flow Check Valve 2-Inch", "CHK", Decimal("68.00"), Decimal("34.00"), "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"),
                ]
            },
            # 3. Office & Ergonomics
            {
                "category": cat_off,
                "prefix": "OFF",
                "supplier": sup_ergo,
                "items": [
                    ("Ergonomic Lumbar Task Chair Elite", "CHR", Decimal("379.00"), Decimal("210.00"), "https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=400"),
                    ("Dual-Motor Electric Standing Desk Frame", "DSK", Decimal("469.00"), Decimal("275.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                    ("Counterbalanced Gas Spring Monitor Arm", "ARM", Decimal("119.00"), Decimal("60.00"), "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400"),
                    ("Contoured Memory Foam Seat Cushion", "CSH", Decimal("49.99"), Decimal("22.00"), "https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=400"),
                    ("Active Dynamic Balance Wobble Stool", "STL", Decimal("139.00"), Decimal("72.00"), "https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=400"),
                    ("Under-Desk Steel Cable Management Tray", "CBL", Decimal("34.99"), Decimal("14.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                    ("Anti-Fatigue Beveled Edge Standing Mat", "MAT", Decimal("62.00"), Decimal("28.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                    ("Articulating Clamp-On Keyboard Tray", "KBD", Decimal("89.00"), Decimal("44.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                    ("Acoustic Sound-Dampening Desk Divider", "DIV", Decimal("79.00"), Decimal("38.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                    ("Ergonomic Rocking Footrest Roller", "FTR", Decimal("45.00"), Decimal("20.00"), "https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=400"),
                    ("Full-Desk Vegan Leather Desk Pad 36x20", "PAD", Decimal("38.50"), Decimal("16.00"), "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400"),
                    ("Adjustable Aluminum Laptop Stand", "LPT", Decimal("44.00"), Decimal("19.00"), "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400"),
                    ("Compact Under-Desk Walking Pad 2.5HP", "TRD", Decimal("289.00"), Decimal("165.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                    ("Adjustable Height Document Copyholder", "DOC", Decimal("29.99"), Decimal("12.00"), "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400"),
                ]
            },
            # 4. Health & Wellness
            {
                "category": cat_hlth,
                "prefix": "HLTH",
                "supplier": sup_nova,
                "items": [
                    ("HEPA-13 Plasma Ion Air Purifier", "PUR", Decimal("199.00"), Decimal("110.00"), "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"),
                    ("Deep Tissue Percussion Muscle Massager", "MSG", Decimal("129.00"), Decimal("62.00"), "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400"),
                    ("Fingertip Pulse Oximeter OLED Display", "OXI", Decimal("32.50"), Decimal("12.00"), "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400"),
                    ("Smart Bluetooth Body Composition Scale", "SCL", Decimal("59.99"), Decimal("27.00"), "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400"),
                    ("Ultrasonic Top-Fill Cool Mist Humidifier", "HUM", Decimal("68.00"), Decimal("31.00"), "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"),
                    ("Non-Contact Infrared Forehead Thermometer", "THM", Decimal("38.00"), Decimal("14.00"), "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400"),
                    ("Digital Upper Arm Blood Pressure Monitor", "BPM", Decimal("64.00"), Decimal("29.00"), "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400"),
                    ("Contoured Cervical Memory Foam Pillow", "PLW", Decimal("54.00"), Decimal("24.00"), "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=400"),
                    ("Aroma Ultrasonic Essential Oil Diffuser", "DIF", Decimal("36.00"), Decimal("15.00"), "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400"),
                    ("UV-C Sanitizing Box for Electronics", "UVC", Decimal("49.00"), Decimal("21.00"), "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400"),
                    ("Shiatsu Heated Neck & Shoulder Massager", "SHI", Decimal("74.50"), Decimal("35.00"), "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400"),
                    ("Cordless High-Pressure Water Flosser", "FLS", Decimal("45.00"), Decimal("19.00"), "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400"),
                    ("Sound Machine White Noise Sleep Aid", "SND", Decimal("39.99"), Decimal("17.00"), "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"),
                ]
            },
            # 5. Home Appliances
            {
                "category": cat_home,
                "prefix": "HOME",
                "supplier": sup_apex,
                "items": [
                    ("Lidar Smart Robot Vacuum & Auto-Mop", "ROB", Decimal("449.00"), Decimal("260.00"), "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400"),
                    ("Digital Air Fryer Convection Oven 8Qt", "AFR", Decimal("139.00"), Decimal("75.00"), "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400"),
                    ("Variable Temp Gooseneck Electric Kettle", "KTL", Decimal("69.99"), Decimal("32.00"), "https://images.unsplash.com/photo-1570533136641-42082aca90b7?w=400"),
                    ("Compact Automatic Countertop Ice Maker", "ICE", Decimal("129.00"), Decimal("68.00"), "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400"),
                    ("Cold Press Masticating Slow Juicer", "JCR", Decimal("119.00"), Decimal("59.00"), "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400"),
                    ("Precision Sous Vide Immersion Cooker", "SVD", Decimal("89.00"), Decimal("43.00"), "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400"),
                    ("Energy Star Smart Wi-Fi Dehumidifier 35Pt", "DHM", Decimal("199.00"), Decimal("115.00"), "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"),
                    ("Touchless Infrared Sensor Trash Can 13Gal", "TSH", Decimal("79.00"), Decimal("36.00"), "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400"),
                    ("Quiet Oscillating Bladeless Tower Fan", "TWR", Decimal("95.00"), Decimal("46.00"), "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"),
                    ("Cordless High-Suction Stick Vacuum 25kPa", "STK", Decimal("179.00"), Decimal("95.00"), "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400"),
                    ("15-Bar Stainless Espresso Machine", "ESP", Decimal("229.00"), Decimal("125.00"), "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400"),
                    ("Smokeless Indoor Electric Ceramic Grill", "GRL", Decimal("85.00"), Decimal("41.00"), "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=400"),
                ]
            }
        ]

        # Model and variant descriptors to produce unique, realistic product names
        modifiers = [
            "Pro", "Elite", "Max", "Prime", "Ultra", "Plus", "Advanced",
            "Edition X", "Signature", "Core", "V2", "Studio", "Series 3",
            "Series 5", "Series 7", "Carbon", "Platinum", "Stealth",
            "Eco", "Compact", "Turbo", "Titan", "Precision", "Modular"
        ]

        # Existing SKUs in DB to prevent collision
        existing_skus = set(Product.objects.values_list('sku', flat=True))

        # Target stock status distribution:
        # ~5% Out of Stock
        # ~15% Low Stock
        # ~15% Overstocked
        # ~65% In Stock
        status_bucket = ['OUT'] * 5 + ['LOW'] * 15 + ['OVER'] * 15 + ['IN'] * 65

        random.seed(2026)

        new_products = []
        supplier_products = []
        stock_movements = []

        item_counter = 100

        self.stdout.write("Generating 1,192 realistic product records...")

        while len(new_products) < needed:
            # Pick a category blueprint in round-robin fashion
            cat_idx = len(new_products) % len(catalog_blueprints)
            bp = catalog_blueprints[cat_idx]

            # Pick an item template from this category
            item_idx = (len(new_products) // len(catalog_blueprints)) % len(bp["items"])
            base_name, sku_mid, base_price, base_cost, img_url = bp["items"][item_idx]

            # Add modifier and counter
            mod = modifiers[item_counter % len(modifiers)]
            iteration = (item_counter // len(modifiers)) + 1

            if iteration == 1:
                prod_name = f"{base_name} {mod}"
            else:
                prod_name = f"{base_name} {mod} Gen-{iteration}"

            sku_candidate = f"{bp['prefix']}-{sku_mid}-{item_counter:04d}"
            item_counter += 1

            if sku_candidate in existing_skus:
                continue
            existing_skus.add(sku_candidate)

            # Price slight variation (+- 15%)
            price_factor = Decimal(str(round(random.uniform(0.85, 1.25), 2)))
            unit_price = round(base_price * price_factor, 2)
            cost_factor = Decimal(str(round(random.uniform(0.50, 0.68), 2)))
            cost_price = round(unit_price * cost_factor, 2)

            reorder_level = random.choice([12, 15, 18, 20, 25])
            safety_stock = random.choice([4, 5, 6, 8, 10])
            lead_time_days = random.choice([5, 7, 8, 10, 12, 14])

            # Determine stock based on distribution
            assigned_status = random.choice(status_bucket)
            if assigned_status == 'OUT':
                current_stock = 0
            elif assigned_status == 'LOW':
                current_stock = random.randint(1, reorder_level)
            elif assigned_status == 'OVER':
                current_stock = random.randint(105, 320)
            else:  # IN_STOCK
                current_stock = random.randint(reorder_level + 1, 98)

            description = f"High-reliability {prod_name.lower()} engineered for professional and commercial applications. Features high durability, standard form factor, and low power footprint."

            product = Product(
                name=prod_name,
                sku=sku_candidate,
                category=bp["category"],
                description=description,
                unit_price=unit_price,
                cost_price=cost_price,
                current_stock=current_stock,
                reorder_level=reorder_level,
                safety_stock=safety_stock,
                lead_time_days=lead_time_days,
                image_url=img_url
            )
            new_products.append((product, bp["supplier"]))

        self.stdout.write(f"Bulk saving {len(new_products)} products to database...")

        with transaction.atomic():
            saved_products = []
            for prod, sup in new_products:
                prod.save()
                saved_products.append((prod, sup))

                # Create SupplierProduct
                if sup:
                    supplier_products.append(SupplierProduct(
                        supplier=sup,
                        product=prod,
                        supplier_sku=f"SUP-{prod.sku}",
                        supply_price=prod.cost_price,
                        lead_time_days=prod.lead_time_days,
                        is_primary=True
                    ))

                # Initial Stock Movement
                if prod.current_stock > 0 and admin_user:
                    stock_movements.append(StockMovement(
                        product=prod,
                        movement_type='IN',
                        quantity=prod.current_stock,
                        previous_stock=0,
                        new_stock=prod.current_stock,
                        reference=f"PO-INIT-{prod.sku[:8]}",
                        reason="Initial catalog warehouse stock entry",
                        created_by=admin_user
                    ))

            SupplierProduct.objects.bulk_create(supplier_products)
            StockMovement.objects.bulk_create(stock_movements)

        # Generate some sales for ~30% of the newly added products to give realistic units sold
        self.stdout.write("Generating sample sales for new catalog items...")
        today = timezone.now().date()
        sales_to_create = []
        customers = ["Apex Logistics", "OmniGlobal", "TechWave", "Metro Retail", "Nordic Studios", "ProSupply Corp"]
        channels = ['IN_STORE', 'ONLINE', 'WHOLESALE', 'B2B']

        with transaction.atomic():
            import uuid
            sale_seq = 1
            for prod, _ in saved_products[::3]:  # Every 3rd product
                num_sales = random.randint(1, 4)
                for _ in range(num_sales):
                    s_date = today - timedelta(days=random.randint(1, 28))
                    qty = random.randint(1, 6)
                    inv_code = uuid.uuid4().hex[:6].upper()
                    sales_to_create.append(Sale(
                        invoice_number=f"INV-{s_date.strftime('%Y%m%d')}-{prod.id}-{sale_seq:04d}-{inv_code}",
                        product=prod,
                        quantity=qty,
                        unit_price=prod.unit_price,
                        total_price=prod.unit_price * qty,
                        sale_date=s_date,
                        customer_name=random.choice(customers),
                        channel=random.choice(channels),
                        created_by=admin_user
                    ))
                    sale_seq += 1

            Sale.objects.bulk_create(sales_to_create)

        final_count = Product.objects.count()
        self.stdout.write(self.style.SUCCESS(f"Successfully populated database! Total products count: {final_count}"))
