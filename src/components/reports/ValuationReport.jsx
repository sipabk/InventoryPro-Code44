import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, DollarSign } from 'lucide-react';
import { formatBWP } from '@/utils/currency';
import DataTable from '../common/DataTable';

export default function ValuationReport({ products, transactions, categories, warehouseFilter, categoryFilter, onExport }) {
  const [valuationMethod, setValuationMethod] = useState('weighted_average');

  const calculateValuation = useMemo(() => {
    const filtered = products.filter(p => {
      const pd = p.data || p;
      if (warehouseFilter !== 'all' && pd.warehouse_id !== warehouseFilter) return false;
      if (categoryFilter !== 'all' && pd.category_id !== categoryFilter) return false;
      return true;
    });

    return filtered.map(product => {
      const pd = product.data || product;
      const productTransactions = transactions.filter(t => {
        const td = t.data || t;
        return td.product_id === product.id && td.type === 'inward';
      }).sort((a, b) => {
        const ad = a.data || a; const bd = b.data || b;
        return new Date(ad.transaction_date) - new Date(bd.transaction_date);
      });

      let unitCost = pd.cost_price || 0;

      if (valuationMethod === 'fifo' && productTransactions.length > 0) {
        const t0 = productTransactions[0].data || productTransactions[0];
        unitCost = t0.unit_cost || unitCost;
      } else if (valuationMethod === 'lifo' && productTransactions.length > 0) {
        const tl = productTransactions[productTransactions.length - 1].data || productTransactions[productTransactions.length - 1];
        unitCost = tl.unit_cost || unitCost;
      } else if (valuationMethod === 'weighted_average' && productTransactions.length > 0) {
        const totalCost = productTransactions.reduce((sum, t) => { const td = t.data || t; return sum + (td.total_cost || 0); }, 0);
        const totalQty = productTransactions.reduce((sum, t) => { const td = t.data || t; return sum + (td.quantity || 0); }, 0);
        unitCost = totalQty > 0 ? totalCost / totalQty : unitCost;
      }

      const currentStock = pd.quantity_in_stock || 0;
      const totalValue = currentStock * unitCost;
      const category = categories.find(c => c.id === pd.category_id);

      return {
        sku: pd.sku,
        name: pd.name,
        category: category?.data?.name || category?.name || 'Uncategorized',
        currentStock,
        unitCost,
        totalValue,
        currency: pd.currency || 'USD'
      };
    });
  }, [products, transactions, categories, warehouseFilter, categoryFilter, valuationMethod]);

  const summary = useMemo(() => {
    const totalValue = calculateValuation.reduce((sum, item) => sum + item.totalValue, 0);
    const totalItems = calculateValuation.length;
    const totalUnits = calculateValuation.reduce((sum, item) => sum + item.currentStock, 0);
    return { totalValue, totalItems, totalUnits };
  }, [calculateValuation]);

  const categoryBreakdown = useMemo(() => {
    const grouped = {};
    calculateValuation.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = 0;
      grouped[item.category] += item.totalValue;
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [calculateValuation]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const columns = [
    { header: 'SKU', accessor: 'sku' },
    { header: 'Product', accessor: 'name' },
    { header: 'Category', accessor: 'category' },
    { header: 'Stock', accessor: 'currentStock' },
    { header: 'Unit Cost (BWP)', accessor: (row) => formatBWP(row.unitCost) },
    { header: 'Total Value (BWP)', accessor: (row) => formatBWP(row.totalValue) }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <DollarSign className="w-5 h-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Inventory Valuation</h2>
          <Select value={valuationMethod} onValueChange={setValuationMethod}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weighted_average">Weighted Average</SelectItem>
              <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
              <SelectItem value="lifo">LIFO (Last In, First Out)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => onExport('inventory-valuation', calculateValuation)}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {formatBWP(summary.totalValue)}
            </p>
            <p className="text-sm text-slate-500 mt-1">{valuationMethod.replace('_', ' ').toUpperCase()} method</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{summary.totalItems.toLocaleString()}</p>
            <p className="text-sm text-slate-500 mt-1">Unique SKUs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{summary.totalUnits.toLocaleString()}</p>
            <p className="text-sm text-slate-500 mt-1">In stock</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Value by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => formatBWP(value)} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Category Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%" cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {categoryBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatBWP(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Detailed Valuation Report</CardTitle></CardHeader>
        <CardContent>
          <DataTable data={calculateValuation} columns={columns} searchPlaceholder="Search products..." pageSize={15} />
        </CardContent>
      </Card>
    </div>
  );
}