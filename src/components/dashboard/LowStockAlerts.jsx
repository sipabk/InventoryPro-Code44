import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function LowStockAlerts({ products, categories }) {
  const lowStockProducts = products
    .filter(p => {
      const stock = p.quantity_in_stock || 0;
      const reorderLevel = p.reorder_level || 0;
      return stock <= reorderLevel && p.status === 'active';
    })
    .sort((a, b) => {
      const aRatio = (a.quantity_in_stock || 0) / (a.reorder_level || 1);
      const bRatio = (b.quantity_in_stock || 0) / (b.reorder_level || 1);
      return aRatio - bRatio;
    })
    .slice(0, 6);

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.data?.name || category?.name || 'N/A';
  };

  const getStockLevel = (product) => {
    const stock = product.quantity_in_stock || 0;
    const reorderLevel = product.reorder_level || 1;
    const ratio = stock / reorderLevel;
    
    if (stock === 0) return { level: 'Out of Stock', color: 'bg-red-100 text-red-700' };
    if (ratio <= 0.25) return { level: 'Critical', color: 'bg-red-100 text-red-700' };
    if (ratio <= 0.5) return { level: 'Very Low', color: 'bg-orange-100 text-orange-700' };
    return { level: 'Low', color: 'bg-yellow-100 text-yellow-700' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Low Stock Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lowStockProducts.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>All products are well stocked</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lowStockProducts.map((product) => {
              const stockLevel = getStockLevel(product);
              return (
                <Link
                  key={product.id}
                  to={createPageUrl('Products')}
                  className="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900">{product.name}</h4>
                      <Badge className={stockLevel.color}>
                        {stockLevel.level}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {getCategoryName(product.category_id)} • SKU: {product.sku}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Stock: {product.quantity_in_stock || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        Reorder at: {product.reorder_level || 0}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      Reorder: {product.reorder_quantity || 0}
                    </p>
                    <p className="text-xs text-slate-500">{product.unit_of_measure || 'units'}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}