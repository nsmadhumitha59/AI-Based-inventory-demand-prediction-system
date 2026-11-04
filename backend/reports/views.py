import csv
from datetime import timedelta
from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Sum, Count, F, Q, Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from inventory.models import Product, Category, StockMovement
from sales.models import Sale
from forecasting.models import ForecastRun, ForecastResult, ReorderRecommendation

class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        thirty_days_ago = today - timedelta(days=30)
        sixty_days_ago = today - timedelta(days=60)

        # 1. Total Products
        total_products = Product.objects.count()

        # 2. Total Stock Available
        total_stock = Product.objects.aggregate(total=Sum('current_stock'))['total'] or 0

        # 3. Units Sold (last 30 days vs prior 30 days)
        units_current_30d = Sale.objects.filter(
            sale_date__gte=thirty_days_ago, sale_date__lte=today
        ).aggregate(total=Sum('quantity'))['total'] or 0

        units_prior_30d = Sale.objects.filter(
            sale_date__gte=sixty_days_ago, sale_date__lt=thirty_days_ago
        ).aggregate(total=Sum('quantity'))['total'] or 0

        if units_prior_30d > 0:
            units_sold_trend = round(((units_current_30d - units_prior_30d) / units_prior_30d) * 100, 1)
        else:
            units_sold_trend = 100.0 if units_current_30d > 0 else 0.0

        # 4. Low Stock Alerts count (current_stock <= reorder_level)
        low_stock_products = Product.objects.filter(current_stock__lte=F('reorder_level'))
        low_stock_count = low_stock_products.count()
        out_of_stock_count = Product.objects.filter(current_stock__lte=0).count()

        # A. Sales Trend Chart (last 30 days daily aggregated)
        sales_30d = (
            Sale.objects.filter(sale_date__gte=thirty_days_ago, sale_date__lte=today)
            .values('sale_date')
            .annotate(units=Sum('quantity'), revenue=Sum('total_price'))
            .order_by('sale_date')
        )
        sales_trend_map = {s['sale_date']: {'units': s['units'], 'revenue': float(s['revenue'])} for s in sales_30d}

        sales_trend_chart = []
        for d in range(30, -1, -1):
            cur_date = today - timedelta(days=d)
            item = sales_trend_map.get(cur_date, {'units': 0, 'revenue': 0.0})
            sales_trend_chart.append({
                'date': cur_date.strftime('%Y-%m-%d'),
                'units': item['units'],
                'revenue': item['revenue']
            })

        # B. Demand Forecast Chart (Aggregated historical sales vs upcoming 30d forecast)
        # Historical actual sales for last 14 days
        fourteen_days_ago = today - timedelta(days=14)
        hist_recent = (
            Sale.objects.filter(sale_date__gte=fourteen_days_ago, sale_date__lte=today)
            .values('sale_date')
            .annotate(actual=Sum('quantity'))
            .order_by('sale_date')
        )
        forecast_chart_data = []
        for h in hist_recent:
            forecast_chart_data.append({
                'date': h['sale_date'].strftime('%Y-%m-%d'),
                'actual': h['actual'],
                'forecast': None
            })

        # Aggregate future forecast results (next 14 days)
        future_forecasts = (
            ForecastResult.objects.filter(
                date__gt=today,
                date__lte=today + timedelta(days=14),
                forecast_run__created_at__gte=timezone.now() - timedelta(days=7)
            )
            .values('date')
            .annotate(pred_sum=Sum('predicted_quantity'))
            .order_by('date')
        )
        for f in future_forecasts:
            forecast_chart_data.append({
                'date': f['date'].strftime('%Y-%m-%d'),
                'actual': None,
                'forecast': round(f['pred_sum'], 1)
            })

        # C. Inventory Distribution (Product stock by category)
        category_distribution = (
            Category.objects.annotate(
                total_stock=Sum('products__current_stock'),
                product_count=Count('products')
            )
            .values('name', 'total_stock', 'product_count')
        )
        inventory_distribution = [
            {
                'category': c['name'],
                'stock': c['total_stock'] or 0,
                'product_count': c['product_count']
            } for c in category_distribution if (c['total_stock'] or 0) > 0 or c['product_count'] > 0
        ]

        # D. Stock Health Overview
        in_stock_count = Product.objects.filter(current_stock__gt=F('reorder_level'), current_stock__lte=100).count()
        overstocked_count = Product.objects.filter(current_stock__gt=100).count()
        stock_health = {
            'in_stock': in_stock_count,
            'low_stock': low_stock_count - out_of_stock_count,
            'out_of_stock': out_of_stock_count,
            'overstocked': overstocked_count,
            'total': total_products
        }

        # E. Top Selling Products
        top_selling = (
            Product.objects.annotate(total_sold=Sum('sales__quantity'))
            .filter(total_sold__gt=0)
            .order_by('-total_sold')[:7]
        )
        top_products_data = []
        for p in top_selling:
            # check recent 14d vs prior 14d sales to determine trend
            sold_recent = Sale.objects.filter(product=p, sale_date__gte=today - timedelta(days=14)).aggregate(s=Sum('quantity'))['s'] or 0
            sold_prev = Sale.objects.filter(product=p, sale_date__gte=today - timedelta(days=28), sale_date__lt=today - timedelta(days=14)).aggregate(s=Sum('quantity'))['s'] or 0
            trend = 'UP' if sold_recent > sold_prev else ('DOWN' if sold_recent < sold_prev else 'STABLE')
            top_products_data.append({
                'id': p.id,
                'name': p.name,
                'sku': p.sku,
                'category': p.category.name if p.category else 'General',
                'quantity_sold': p.total_sold or 0,
                'current_stock': p.current_stock,
                'trend': trend
            })

        # F. Inventory Alerts
        alerts = []
        # Critical out of stock
        for p in Product.objects.filter(current_stock__lte=0)[:5]:
            alerts.append({
                'type': 'OUT_OF_STOCK',
                'severity': 'critical',
                'title': f'Out of Stock: {p.name}',
                'message': f'SKU {p.sku} has 0 units remaining. Demand cannot be met.',
                'product_id': p.id,
                'sku': p.sku
            })
        # Low stock warnings
        for p in Product.objects.filter(current_stock__gt=0, current_stock__lte=F('reorder_level'))[:5]:
            alerts.append({
                'type': 'LOW_STOCK',
                'severity': 'warning',
                'title': f'Low Stock Alert: {p.name}',
                'message': f'SKU {p.sku} has {p.current_stock} units left (Reorder point: {p.reorder_level}).',
                'product_id': p.id,
                'sku': p.sku
            })
        # Predicted stockouts
        upcoming_stockouts = ReorderRecommendation.objects.filter(
            estimated_stockout_date__isnull=False,
            estimated_stockout_date__lte=today + timedelta(days=14),
            status='PENDING'
        ).select_related('product')[:5]
        for rec in upcoming_stockouts:
            alerts.append({
                'type': 'PREDICTED_STOCKOUT',
                'severity': 'danger',
                'title': f'Predicted Stockout: {rec.product.name}',
                'message': f"Expected to run out by {rec.estimated_stockout_date.strftime('%b %d, %Y')}. Lead time is {rec.product.lead_time_days} days.",
                'product_id': rec.product.id,
                'sku': rec.product.sku
            })

        return Response({
            'metrics': {
                'total_products': total_products,
                'total_stock': total_stock,
                'units_sold_30d': units_current_30d,
                'units_sold_trend': units_sold_trend,
                'low_stock_alerts': low_stock_count,
                'out_of_stock_alerts': out_of_stock_count
            },
            'sales_trend_chart': sales_trend_chart,
            'demand_forecast_chart': forecast_chart_data,
            'inventory_distribution': inventory_distribution,
            'stock_health': stock_health,
            'top_selling_products': top_products_data,
            'alerts': alerts
        }, status=status.HTTP_200_OK)


class InventoryReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        export_format = request.query_params.get('format', 'json')
        products = Product.objects.all().select_related('category').prefetch_related('sales')

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="inventory_summary_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['SKU', 'Name', 'Category', 'Current Stock', 'Reorder Level', 'Unit Price', 'Inventory Value', 'Status'])
            for p in products:
                writer.writerow([
                    p.sku, p.name, p.category.name if p.category else 'N/A',
                    p.current_stock, p.reorder_level, p.unit_price,
                    round(p.current_stock * p.unit_price, 2), p.stock_status
                ])
            return response

        total_value = sum(p.current_stock * p.unit_price for p in products)
        data = [
            {
                'id': p.id,
                'sku': p.sku,
                'name': p.name,
                'category': p.category.name if p.category else 'N/A',
                'current_stock': p.current_stock,
                'reorder_level': p.reorder_level,
                'unit_price': float(p.unit_price),
                'inventory_value': float(round(p.current_stock * p.unit_price, 2)),
                'status': p.stock_status
            } for p in products
        ]
        return Response({'total_inventory_value': float(total_value), 'products': data})


class SalesReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        export_format = request.query_params.get('format', 'json')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        sales = Sale.objects.all().select_related('product', 'product__category')
        if start_date:
            sales = sales.filter(sale_date__gte=start_date)
        if end_date:
            sales = sales.filter(sale_date__lte=end_date)

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="sales_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['Invoice #', 'Date', 'SKU', 'Product', 'Quantity', 'Unit Price', 'Total Revenue', 'Customer', 'Channel'])
            for s in sales:
                writer.writerow([
                    s.invoice_number, s.sale_date.strftime('%Y-%m-%d'),
                    s.product.sku, s.product.name, s.quantity, s.unit_price,
                    s.total_price, s.customer_name, s.get_channel_display()
                ])
            return response

        total_rev = sales.aggregate(s=Sum('total_price'))['s'] or Decimal('0.00')
        total_units = sales.aggregate(s=Sum('quantity'))['s'] or 0

        data = [
            {
                'id': s.id,
                'invoice_number': s.invoice_number,
                'date': s.sale_date.strftime('%Y-%m-%d'),
                'sku': s.product.sku,
                'product_name': s.product.name,
                'category': s.product.category.name if s.product.category else 'N/A',
                'quantity': s.quantity,
                'unit_price': float(s.unit_price),
                'total_price': float(s.total_price),
                'customer': s.customer_name,
                'channel': s.get_channel_display()
            } for s in sales[:200]
        ]
        return Response({
            'total_revenue': float(total_rev),
            'total_units_sold': total_units,
            'sales': data
        })


class LowStockReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        export_format = request.query_params.get('format', 'json')
        products = Product.objects.filter(current_stock__lte=F('reorder_level')).select_related('category')

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="low_stock_report.csv"'
            writer = csv.writer(response)
            writer.writerow(['SKU', 'Product Name', 'Category', 'Current Stock', 'Reorder Level', 'Deficit', 'Status'])
            for p in products:
                writer.writerow([
                    p.sku, p.name, p.category.name if p.category else 'N/A',
                    p.current_stock, p.reorder_level, max(0, p.reorder_level - p.current_stock), p.stock_status
                ])
            return response

        data = [
            {
                'id': p.id,
                'sku': p.sku,
                'name': p.name,
                'category': p.category.name if p.category else 'N/A',
                'current_stock': p.current_stock,
                'reorder_level': p.reorder_level,
                'deficit': max(0, p.reorder_level - p.current_stock),
                'status': p.stock_status
            } for p in products
        ]
        return Response({'low_stock_count': len(data), 'products': data})
