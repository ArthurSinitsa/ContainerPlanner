from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, ContainerTypeViewSet, CalculationViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'containers', ContainerTypeViewSet, basename='container')
router.register(r'calculate', CalculationViewSet, basename='calculate')

urlpatterns = [
    path('', include(router.urls)),
]