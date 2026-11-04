from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GenerateForecastView,
    ProductForecastDetailView,
    ForecastRunHistoryListView,
    ReorderRecommendationViewSet
)

router = DefaultRouter()
router.register(r'recommendations', ReorderRecommendationViewSet, basename='reorder-recommendation')

urlpatterns = [
    path('generate/', GenerateForecastView.as_view(), name='generate_forecast'),
    path('product/<int:product_id>/', ProductForecastDetailView.as_view(), name='product_forecast_detail'),
    path('history/', ForecastRunHistoryListView.as_view(), name='forecast_history'),
    path('', include(router.urls)),
]
