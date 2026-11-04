from datetime import timedelta
from rest_framework import generics, viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import models
from django.db.models import Sum
from django.utils import timezone
from django.shortcuts import get_object_or_404
from inventory.models import Product
from sales.models import Sale
from .models import ForecastRun, ForecastResult, ReorderRecommendation
from .serializers import (
    ForecastRunSerializer,
    ForecastResultSerializer,
    ReorderRecommendationSerializer,
    GenerateForecastInputSerializer
)
from .ml_engine import DemandForecastEngine, NoSalesDataError

class GenerateForecastView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = GenerateForecastInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        product_id = serializer.validated_data['product_id']
        horizon_days = serializer.validated_data['horizon_days']
        product = get_object_or_404(Product, id=product_id)

        # Run AI forecasting engine
        try:
            engine = DemandForecastEngine(product=product, horizon_days=horizon_days)
            forecast_run, recommendation = engine.run_forecast()
        except NoSalesDataError as e:
            return Response({
                'error': 'NO_SALES_DATA',
                'detail': str(e),
                'product_id': product.id,
                'product_name': product.name,
                'product_sku': product.sku,
                'required_csv_columns': ['Invoice #', 'Sale Date', 'SKU', 'Quantity', 'Unit Price', 'Customer', 'Channel'],
                'date_format': 'YYYY-MM-DD (e.g., 2026-03-15)'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Fetch historical sales for chart (last 90 days)
        cutoff_date = timezone.now().date() - timedelta(days=90)
        historical_sales = (
            Sale.objects.filter(product=product, sale_date__gte=cutoff_date)
            .values('sale_date')
            .annotate(quantity=models.Sum('quantity'))
            .order_by('sale_date')
        )
        historical_data = [
            {'date': s['sale_date'].strftime('%Y-%m-%d'), 'actual_quantity': s['quantity']}
            for s in historical_sales
        ]

        run_data = ForecastRunSerializer(forecast_run).data
        rec_data = ReorderRecommendationSerializer(recommendation).data

        return Response({
            'forecast_run': run_data,
            'recommendation': rec_data,
            'historical_sales': historical_data,
            'message': f"Forecast generated successfully for {product.name}."
        }, status=status.HTTP_201_CREATED)

class ProductForecastDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(Product, id=product_id)
        latest_run = ForecastRun.objects.filter(product=product).first()
        sales_count = Sale.objects.filter(product=product).count()

        # Fetch historical sales (last 90 days)
        cutoff_date = timezone.now().date() - timedelta(days=90)
        historical_sales = (
            Sale.objects.filter(product=product, sale_date__gte=cutoff_date)
            .values('sale_date')
            .annotate(quantity=Sum('quantity'))
            .order_by('sale_date')
        )
        historical_data = [
            {'date': s['sale_date'].strftime('%Y-%m-%d'), 'actual_quantity': s['quantity']}
            for s in historical_sales
        ]

        latest_rec = ReorderRecommendation.objects.filter(product=product).first()

        return Response({
            'product_id': product.id,
            'product_name': product.name,
            'product_sku': product.sku,
            'current_stock': product.current_stock,
            'reorder_level': product.reorder_level,
            'safety_stock': product.safety_stock,
            'lead_time_days': product.lead_time_days,
            'sales_count': sales_count,
            'has_sales_data': sales_count > 0,
            'latest_run': ForecastRunSerializer(latest_run).data if latest_run else None,
            'recommendation': ReorderRecommendationSerializer(latest_rec).data if latest_rec else None,
            'historical_sales': historical_data,
        }, status=status.HTTP_200_OK)

class ForecastRunHistoryListView(generics.ListAPIView):
    serializer_class = ForecastRunSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ForecastRun.objects.all().select_related('product')
        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

class ReorderRecommendationViewSet(viewsets.ModelViewSet):
    queryset = ReorderRecommendation.objects.all().select_related('product', 'product__category')
    serializer_class = ReorderRecommendationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        priority = self.request.query_params.get('priority')
        status_param = self.request.query_params.get('status')
        if priority:
            qs = qs.filter(priority=priority)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        rec = self.get_object()
        new_status = request.data.get('status', 'REVIEWED')
        if new_status not in dict(ReorderRecommendation.STATUS_CHOICES):
            return Response({'error': f"Invalid status: {new_status}"}, status=status.HTTP_400_BAD_REQUEST)

        rec.status = new_status
        rec.reviewed_at = timezone.now()
        rec.save(update_fields=['status', 'reviewed_at'])
        return Response(ReorderRecommendationSerializer(rec).data, status=status.HTTP_200_OK)
