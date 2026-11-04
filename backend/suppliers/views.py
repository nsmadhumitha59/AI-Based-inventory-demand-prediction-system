from rest_framework import viewsets, permissions, filters
from django.db.models import Prefetch
from .models import Supplier, SupplierProduct
from .serializers import SupplierSerializer, SupplierProductSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    # FIX: Use Prefetch + select_related instead of the double-underscore form
    # 'prefetch_related("supplied_products__product")' generates a single SQL IN clause
    # containing all product IDs. With 1,200 products SQLite raises:
    # "Expression tree is too large (maximum depth 1000)" → 500 error on the frontend.
    # Using Prefetch with select_related issues two efficient JOIN queries instead.
    queryset = Supplier.objects.all().prefetch_related(
        Prefetch(
            'supplied_products',
            queryset=SupplierProduct.objects.select_related('product'),
        )
    )
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'contact_person', 'email', 'phone']
    ordering_fields = ['name', 'lead_time_days', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs


class SupplierProductViewSet(viewsets.ModelViewSet):
    queryset = SupplierProduct.objects.all().select_related('supplier', 'product')
    serializer_class = SupplierProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['product__name', 'product__sku', 'supplier__name']

