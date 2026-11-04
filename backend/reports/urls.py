from django.urls import path
from .views import DashboardView, InventoryReportView, SalesReportView, LowStockReportView

urlpatterns = [
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('reports/inventory/', InventoryReportView.as_view(), name='report_inventory'),
    path('reports/sales/', SalesReportView.as_view(), name='report_sales'),
    path('reports/low-stock/', LowStockReportView.as_view(), name='report_low_stock'),
]
