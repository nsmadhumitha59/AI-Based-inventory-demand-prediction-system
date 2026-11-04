from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from inventory.views import CategoryViewSet, ProductViewSet, StockMovementViewSet
from sales.views import SaleViewSet
from suppliers.views import SupplierViewSet, SupplierProductViewSet
from forecasting.views import (
    ReorderRecommendationViewSet,
    GenerateForecastView,
    ProductForecastDetailView,
    ForecastRunHistoryListView
)
from reports.views import (
    DashboardView,
    InventoryReportView,
    SalesReportView,
    LowStockReportView
)

# Unified API router
router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'supplier-products', SupplierProductViewSet, basename='supplier-product')
router.register(r'recommendations', ReorderRecommendationViewSet, basename='recommendation')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication & Profile
    path('api/auth/', include('accounts.urls')),

    # Dashboard endpoint (as specified in prompt: GET /api/dashboard/)
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),

    # Forecasting endpoints (as specified in prompt: POST /api/forecast/generate/, GET /api/forecast/history/)
    path('api/forecast/generate/', GenerateForecastView.as_view(), name='forecast_generate'),
    path('api/forecast/history/', ForecastRunHistoryListView.as_view(), name='forecast_history'),
    path('api/forecast/product/<int:product_id>/', ProductForecastDetailView.as_view(), name='forecast_product_detail'),

    # Reports endpoints
    path('api/reports/inventory/', InventoryReportView.as_view(), name='report_inventory'),
    path('api/reports/sales/', SalesReportView.as_view(), name='report_sales'),
    path('api/reports/low-stock/', LowStockReportView.as_view(), name='report_low_stock'),

    # Router endpoints (products, sales, suppliers, recommendations, categories, stock-movements)
    path('api/', include(router.urls)),
]
