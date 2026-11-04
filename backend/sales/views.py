import csv
import io
from datetime import timedelta
from decimal import Decimal
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db.models import Sum, Count, Avg, F
from django.utils import timezone
from .models import Sale
from .serializers import SaleSerializer
from inventory.models import Category, Product

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all().select_related('product', 'created_by')
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'product__name', 'product__sku', 'customer_name']
    ordering_fields = ['sale_date', 'total_price', 'quantity', 'created_at']
    ordering = ['-sale_date', '-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        product_id = self.request.query_params.get('product')
        channel = self.request.query_params.get('channel')

        if start_date:
            qs = qs.filter(sale_date__gte=start_date)
        if end_date:
            qs = qs.filter(sale_date__lte=end_date)
        if product_id:
            qs = qs.filter(product_id=product_id)
        if channel:
            qs = qs.filter(channel=channel)

        return qs

    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        qs = self.get_queryset()

        total_units = qs.aggregate(units=Sum('quantity'))['units'] or 0
        total_revenue = qs.aggregate(rev=Sum('total_price'))['rev'] or Decimal('0.00')
        total_orders = qs.count()
        avg_order_value = round(float(total_revenue) / total_orders, 2) if total_orders > 0 else 0.0

        # Daily sales trend (last 30 days or filtered range)
        daily_trends = (
            qs.values('sale_date')
            .annotate(
                units=Sum('quantity'),
                revenue=Sum('total_price'),
                orders=Count('id')
            )
            .order_by('sale_date')
        )

        # Category sales distribution
        category_sales = (
            qs.values('product__category__name')
            .annotate(
                units=Sum('quantity'),
                revenue=Sum('total_price')
            )
            .order_by('-revenue')
        )
        category_data = [
            {
                'category': item['product__category__name'] or 'Uncategorized',
                'units': item['units'],
                'revenue': float(item['revenue'])
            } for item in category_sales
        ]

        # Top selling products
        top_products = (
            qs.values('product__id', 'product__name', 'product__sku')
            .annotate(
                units_sold=Sum('quantity'),
                total_revenue=Sum('total_price')
            )
            .order_by('-units_sold')[:10]
        )

        # Sales channel distribution
        channel_data = (
            qs.values('channel')
            .annotate(
                units=Sum('quantity'),
                revenue=Sum('total_price'),
                orders=Count('id')
            )
        )

        return Response({
            'total_units_sold': total_units,
            'total_revenue': float(total_revenue),
            'total_orders': total_orders,
            'average_order_value': avg_order_value,
            'daily_trends': list(daily_trends),
            'category_sales': category_data,
            'top_products': list(top_products),
            'channel_breakdown': list(channel_data)
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="stockwise_sales_report.csv"'

        writer = csv.writer(response)
        writer.writerow(['Invoice #', 'Sale Date', 'SKU', 'Product Name', 'Quantity', 'Unit Price', 'Total Price', 'Customer', 'Channel'])

        for sale in self.get_queryset():
            writer.writerow([
                sale.invoice_number,
                sale.sale_date.strftime('%Y-%m-%d'),
                sale.product.sku,
                sale.product.name,
                sale.quantity,
                sale.unit_price,
                sale.total_price,
                sale.customer_name,
                sale.get_channel_display()
            ])

        return response

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({
                'error': 'Please provide a valid CSV file.',
                'expected_columns': ['Invoice #', 'Sale Date', 'SKU', 'Quantity', 'Unit Price', 'Customer', 'Channel'],
                'date_format': 'YYYY-MM-DD (e.g., 2026-03-15)'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded_file = csv_file.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)

            created_count = 0
            updated_count = 0
            errors = []

            for row_idx, row in enumerate(reader, start=2):
                inv = (row.get('Invoice #') or row.get('invoice_number') or row.get('Invoice') or '').strip()
                sale_date_str = (row.get('Sale Date') or row.get('sale_date') or row.get('Date') or '').strip()
                sku = (row.get('SKU') or row.get('sku') or row.get('Product SKU') or '').strip()
                qty_str = (row.get('Quantity') or row.get('quantity') or row.get('Qty') or '1').strip()
                price_str = (row.get('Unit Price') or row.get('unit_price') or row.get('Price') or '').strip()
                customer = (row.get('Customer') or row.get('customer_name') or 'Customer').strip()
                channel = (row.get('Channel') or row.get('channel') or 'IN_STORE').strip()

                if not sku:
                    errors.append(f"Row {row_idx}: Missing product SKU.")
                    continue

                product = Product.objects.filter(sku__iexact=sku).first()
                if not product:
                    errors.append(f"Row {row_idx}: Product with SKU '{sku}' not found.")
                    continue

                # Parse date
                try:
                    from datetime import datetime
                    sale_date = datetime.strptime(sale_date_str, '%Y-%m-%d').date()
                except Exception:
                    try:
                        from dateutil import parser as dt_parser
                        sale_date = dt_parser.parse(sale_date_str).date()
                    except Exception:
                        errors.append(f"Row {row_idx}: Invalid date format '{sale_date_str}'. Expected YYYY-MM-DD.")
                        continue

                try:
                    qty = int(qty_str)
                    if qty <= 0:
                        errors.append(f"Row {row_idx}: Quantity must be positive.")
                        continue
                except ValueError:
                    errors.append(f"Row {row_idx}: Invalid quantity '{qty_str}'.")
                    continue

                unit_price = Decimal(str(price_str)) if price_str else product.unit_price
                total_price = unit_price * qty

                if not inv:
                    import uuid
                    inv = f"INV-{sale_date.strftime('%Y%m%d')}-{product.sku[:4]}-{uuid.uuid4().hex[:6].upper()}"

                ch_clean = channel.upper().replace(' ', '_').replace('-', '_')
                valid_channels = ['IN_STORE', 'ONLINE', 'WHOLESALE', 'B2B']
                ch = ch_clean if ch_clean in valid_channels else 'IN_STORE'

                sale, created = Sale.objects.update_or_create(
                    invoice_number=inv,
                    defaults={
                        'product': product,
                        'quantity': qty,
                        'unit_price': unit_price,
                        'total_price': total_price,
                        'sale_date': sale_date,
                        'customer_name': customer,
                        'channel': ch,
                        'created_by': request.user if request.user.is_authenticated else None
                    }
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

            return Response({
                'created_count': created_count,
                'updated_count': updated_count,
                'errors': errors[:20],
                'message': f"Import complete: {created_count} sales created, {updated_count} updated."
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
