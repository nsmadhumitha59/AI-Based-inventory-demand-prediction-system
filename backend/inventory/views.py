import csv
import io
import re
from decimal import Decimal
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db import models
from django.db.models import Q, Sum, F
from .models import Category, Product, StockMovement
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    StockMovementSerializer,
    StockAdjustmentSerializer
)

from rest_framework.pagination import PageNumberPagination
from django.db.models.functions import Coalesce

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

class ProductPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ProductPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'sku', 'category__name', 'description']
    ordering_fields = ['name', 'sku', 'current_stock', 'unit_price', 'created_at', 'updated_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        category_id = self.request.query_params.get('category')
        stock_status = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if category_id:
            qs = qs.filter(category_id=category_id)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(sku__icontains=search) | Q(description__icontains=search))

        # Filter by stock status
        if stock_status == 'OUT_OF_STOCK':
            qs = qs.filter(current_stock__lte=0)
        elif stock_status == 'LOW_STOCK':
            qs = qs.filter(current_stock__gt=0, current_stock__lte=models.F('reorder_level'))
        elif stock_status == 'IN_STOCK':
            qs = qs.filter(current_stock__gt=models.F('reorder_level'), current_stock__lte=100)
        elif stock_status == 'OVERSTOCKED':
            qs = qs.filter(current_stock__gt=100)

        # Annotate total units sold to avoid N+1 queries during serialization
        qs = qs.annotate(annotated_units_sold=Coalesce(Sum('sales__quantity'), 0))

        return qs

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request):
        """
        Lightweight catalog lookup endpoint returning all products with sales count,
        ordered so products with historical sales appear first.
        Used for dropdowns, selectors, and forecasting picker.
        """
        products = (
            Product.objects.annotate(sales_count=models.Count('sales'))
            .order_by('-sales_count', 'name')
            .values('id', 'name', 'sku', 'category__name', 'current_stock', 'reorder_level', 'sales_count')
        )
        return Response(list(products))

    @action(detail=True, methods=['post'], url_path='adjust-stock')
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        serializer = StockAdjustmentSerializer(data=request.data)
        if serializer.is_valid():
            movement = serializer.adjust(product, user=request.user)
            return Response({
                'message': 'Stock successfully adjusted.',
                'product': ProductSerializer(product).data,
                'movement': StockMovementSerializer(movement).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='movements')
    def stock_movements(self, request, pk=None):
        product = self.get_object()
        movements = product.stock_movements.all().order_by('-created_at')
        page = self.paginate_queryset(movements)
        if page is not None:
            serializer = StockMovementSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = StockMovementSerializer(movements, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="stockwise_inventory_export.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'SKU', 'Name', 'Category', 'Unit Price', 'Cost Price',
            'Current Stock', 'Reorder Level', 'Safety Stock', 'Lead Time (Days)', 'Stock Status'
        ])

        for prod in Product.objects.all().select_related('category'):
            writer.writerow([
                prod.sku,
                prod.name,
                prod.category.name if prod.category else 'Uncategorized',
                prod.unit_price,
                prod.cost_price,
                prod.current_stock,
                prod.reorder_level,
                prod.safety_stock,
                prod.lead_time_days,
                prod.stock_status
            ])

        return response

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'Please provide a valid CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Try UTF-8-with-BOM first (Excel default), fall back to plain UTF-8
            raw_bytes = csv_file.read()
            try:
                decoded_file = raw_bytes.decode('utf-8-sig')  # strips BOM if present
            except UnicodeDecodeError:
                decoded_file = raw_bytes.decode('utf-8', errors='replace')

            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)

            # ----------------------------------------------------------------
            # Canonical header map: normalised key → model field name
            # Normalised key = raw_header.strip().lower() with inner spaces/
            # underscores/hyphens collapsed to a single space.
            # ----------------------------------------------------------------
            HEADER_MAP = {
                # ── SKU / product-code variants ──────────────────────────────
                'sku': 'sku',
                'product sku': 'sku',
                'product sku': 'sku',
                'item sku': 'sku',
                'product code': 'sku',
                'item code': 'sku',
                'code': 'sku',
                'item no': 'sku',
                'item number': 'sku',
                'part no': 'sku',
                'part number': 'sku',
                'part': 'sku',
                'barcode': 'sku',
                'upc': 'sku',
                'article no': 'sku',
                'article number': 'sku',
                'ref': 'sku',
                'reference': 'sku',
                'id': 'sku',
                'product id': 'sku',
                'item id': 'sku',
                # ── Name variants ────────────────────────────────────────────
                'name': 'name',
                'product name': 'name',
                'item name': 'name',
                'item': 'name',
                'title': 'name',
                'description': 'name',
                'product description': 'name',
                # ── Category ────────────────────────────────────────────────
                'category': 'category',
                'category name': 'category',
                'department': 'category',
                'type': 'category',
                # ── Unit price variants ──────────────────────────────────────
                'unit price': 'unit_price',
                'price': 'unit_price',
                'selling price': 'unit_price',
                'sale price': 'unit_price',
                'retail price': 'unit_price',
                'msrp': 'unit_price',
                # ── Cost price variants ──────────────────────────────────────
                'cost price': 'cost_price',
                'cost': 'cost_price',
                'purchase price': 'cost_price',
                'wholesale price': 'cost_price',
                # ── Stock / quantity variants ────────────────────────────────
                'current stock': 'current_stock',
                'stock': 'current_stock',
                'stock quantity': 'current_stock',
                'quantity': 'current_stock',
                'qty': 'current_stock',
                'on hand': 'current_stock',
                'inventory': 'current_stock',
                'inventory quantity': 'current_stock',
                'available': 'current_stock',
                'available quantity': 'current_stock',
                # ── Reorder level ────────────────────────────────────────────
                'reorder level': 'reorder_level',
                'reorder': 'reorder_level',
                'reorder point': 'reorder_level',
                'min stock': 'reorder_level',
                'minimum stock': 'reorder_level',
                'minimum quantity': 'reorder_level',
                'min qty': 'reorder_level',
                # ── Safety stock ─────────────────────────────────────────────
                'safety stock': 'safety_stock',
                'buffer stock': 'safety_stock',
                'safety quantity': 'safety_stock',
                # ── Lead time ────────────────────────────────────────────────
                'lead time (days)': 'lead_time_days',
                'lead time days': 'lead_time_days',
                'lead time': 'lead_time_days',
                'leadtime': 'lead_time_days',
                'lead days': 'lead_time_days',
                'days to restock': 'lead_time_days',
                # ── Intentionally ignored (read-only computed field) ─────────
                'stock status': None,
            }

            def normalise_header(h):
                """Strip BOM/whitespace, collapse underscores/hyphens/spaces → single space, lowercase."""
                h = h.strip().lstrip('\ufeff')
                h = re.sub(r'[\s_\-]+', ' ', h).lower()
                return h.strip()  # also strip any trailing space after collapse

            # ── Build col_map: raw CSV header → canonical model field (None = ignore) ──
            if reader.fieldnames is None:
                return Response(
                    {'error': 'CSV file appears empty or has no header row.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            col_map = {}  # raw csv column name → model field name (or None = ignore)
            for raw_header in (reader.fieldnames or []):
                norm = normalise_header(raw_header)
                canonical = HEADER_MAP.get(norm)  # returns None for both unknown AND intentional ignores
                if canonical is not None or norm in HEADER_MAP:
                    col_map[raw_header] = canonical

            # ── Pre-flight: ensure a SKU-type column was found ───────────────
            sku_columns = [col for col, field in col_map.items() if field == 'sku']
            if not sku_columns:
                detected = ', '.join(f'"{h}"' for h in (reader.fieldnames or [])) or '(none)'
                accepted = 'SKU, Product SKU, Product Code, Item Code, Barcode, Part No, Item No, ID'
                return Response({
                    'error': (
                        f'No SKU column found in your CSV. '
                        f'Detected columns: {detected}. '
                        f'Please add one of: {accepted}.'
                    ),
                    'created_count': 0,
                    'updated_count': 0,
                    'skipped_count': 0,
                    'error_count': 1,
                    'errors': [
                        f'Header error: no SKU column found. '
                        f'Detected columns: {detected}. '
                        f'Please rename a column to one of: {accepted}.'
                    ],
                }, status=status.HTTP_400_BAD_REQUEST)

            # ── Pre-flight: also check a Name-type column exists ─────────────
            name_columns = [col for col, field in col_map.items() if field == 'name']
            if not name_columns:
                detected = ', '.join(f'"{h}"' for h in (reader.fieldnames or [])) or '(none)'
                return Response({
                    'error': (
                        f'No Name column found in your CSV. '
                        f'Detected columns: {detected}. '
                        f'Please add one of: Name, Product Name, Title, Description.'
                    ),
                    'created_count': 0,
                    'updated_count': 0,
                    'skipped_count': 0,
                    'error_count': 1,
                    'errors': [
                        f'Header error: no Name column found. Detected: {detected}.'
                    ],
                }, status=status.HTTP_400_BAD_REQUEST)

            def get_field(row, field_name, default=''):
                """Return the row value for a canonical model field, stripped."""
                for csv_col, model_field in col_map.items():
                    if model_field == field_name:
                        val = row.get(csv_col, '')
                        return (val or '').strip()
                return default

            created_count = 0
            updated_count = 0
            skipped_count = 0
            errors = []

            for row_idx, row in enumerate(reader, start=2):
                # Skip entirely blank rows
                if all((v or '').strip() == '' for v in row.values()):
                    skipped_count += 1
                    continue

                sku = get_field(row, 'sku').upper()
                name = get_field(row, 'name')

                if not sku:
                    # The SKU column header was found (pre-flight passed) but this cell is blank
                    sku_col_name = sku_columns[0]  # use the actual detected column name
                    errors.append(
                        f"Row {row_idx}: SKU value is blank in column '{sku_col_name}'. "
                        f"Every row must have a unique SKU."
                    )
                    continue
                if not name:
                    name_col_name = name_columns[0] if name_columns else 'Name'
                    errors.append(
                        f"Row {row_idx} (SKU={sku}): Name value is blank in column '{name_col_name}'. "
                        f"Every product must have a name."
                    )
                    continue

                cat_name = get_field(row, 'category')
                raw_unit_price  = get_field(row, 'unit_price',  '0.00')
                raw_cost_price  = get_field(row, 'cost_price',  '0.00')
                raw_stock       = get_field(row, 'current_stock', '0')
                raw_reorder     = get_field(row, 'reorder_level', '15')
                raw_safety      = get_field(row, 'safety_stock',  '5')
                raw_lead        = get_field(row, 'lead_time_days', '7')

                # Validate numeric fields
                try:
                    unit_price = Decimal(raw_unit_price or '0.00')
                except Exception:
                    errors.append(f"Row {row_idx} (SKU={sku}): Invalid price '{raw_unit_price}'.")
                    continue
                try:
                    cost_price = Decimal(raw_cost_price or '0.00')
                except Exception:
                    cost_price = Decimal('0.00')
                try:
                    current_stock = int(float(raw_stock or '0'))
                except Exception:
                    errors.append(f"Row {row_idx} (SKU={sku}): Invalid stock quantity '{raw_stock}'.")
                    continue
                try:
                    reorder_level = int(float(raw_reorder or '15'))
                except Exception:
                    reorder_level = 15
                try:
                    safety_stock = int(float(raw_safety or '5'))
                except Exception:
                    safety_stock = 5
                try:
                    lead_time_days = int(float(raw_lead or '7'))
                except Exception:
                    lead_time_days = 7

                # Resolve / create category
                category = None
                if cat_name:
                    category, _ = Category.objects.get_or_create(name=cat_name)

                try:
                    product, created = Product.objects.update_or_create(
                        sku__iexact=sku,
                        defaults={
                            'sku': sku,
                            'name': name,
                            'category': category,
                            'unit_price': unit_price,
                            'cost_price': cost_price,
                            'current_stock': current_stock,
                            'reorder_level': reorder_level,
                            'safety_stock': safety_stock,
                            'lead_time_days': lead_time_days,
                        }
                    )
                    if created:
                        created_count += 1
                        # Record initial stock-in movement
                        if current_stock > 0:
                            StockMovement.objects.create(
                                product=product,
                                movement_type='IN',
                                quantity=current_stock,
                                previous_stock=0,
                                new_stock=current_stock,
                                reference='CSV Import',
                                reason='Initial stock from CSV import',
                                created_by=request.user,
                            )
                    else:
                        updated_count += 1
                except Exception as ex:
                    errors.append(f"Row {row_idx} (SKU={sku}): {str(ex)}")

            total_processed = created_count + updated_count
            summary = (
                f"Import complete: {created_count} created, {updated_count} updated"
                + (f", {skipped_count} blank rows skipped" if skipped_count else "")
                + (f", {len(errors)} row(s) had errors" if errors else "")
                + "."
            )

            return Response({
                'message': summary,
                'created_count': created_count,
                'updated_count': updated_count,
                'skipped_count': skipped_count,
                'error_count': len(errors),
                'errors': errors,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.all().select_related('product', 'created_by')
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'product__sku', 'reference', 'reason']
    ordering_fields = ['created_at', 'quantity']
    ordering = ['-created_at']
