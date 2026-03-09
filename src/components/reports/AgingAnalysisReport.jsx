import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Clock } from 'lucide-react';
import DataTable from '../common/DataTable';

export default function AgingAnalysisReport({ products, dateFrom, dateTo, warehouseFilter, categoryFilter, onExport }) {
  const agingData = useMemo(() => {
    const today = new Date();
    const filtered = products.filter(p => {
      const pd = p.data || p;
      if (warehouseFilter !== 'all' && pd.warehouse_id !== warehouseFilter) return false;
      if (categoryFilter !== 'all' && pd.category_id !== categoryFilter) return false;
      return true;
    });

    return filtered.map(product => {
      const pd = product.data || product;
      const purchaseDate = pd.purchase_date ? new Date(pd.purchase_date) : new Date();
      const daysOld = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
      
      let ageGroup = '0-30 days';
      if (daysOld > 180) ageGroup = '180+ days';
      else if (daysOld > 90) ageGroup = '91-180 days';
      else if (daysOld > 60) ageGroup = '61-90 days';
      else if (daysOld > 30) ageGroup = '31-60 days';

      const value = (pd.quantity_in_stock || 0) * (pd.cost_price || 0);

      return {
        name: pd.name,
        sku: pd.sku,
        daysOld,
        ageGroup,
        quantity: pd.quantity_in_stock || 0,
        costPrice: pd.cost_price || 0,
        value: value,
        purchaseDate: pd.purchase_date || 'N/A'
      };
    });
  }, [products, warehouseFilter, categoryFilter]);

  const agingGroups = useMemo(() => {
    const groups = {
      '0-30 days': 0,
      '31-60 days': 0,
      '61-90 days': 0,
      '91-180 days': 0,
      '180+ days': 0
    };

    agingData.forEach(item => {
      groups[item.ageGroup] += item.value;
    });

    return Object.entries(groups).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [agingData]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#991b1b'];

  const columns = [
    { header: 'SKU', accessor: 'sku' },
    { header: 'Product', accessor: 'name' },
    { header: 'Purchase Date', accessor: 'purchaseDate' },
    { header: 'Days Old', accessor: 'daysOld' },
    { header: 'Age Group', accessor: 'ageGroup' },
    { header: 'Quantity', accessor: 'quantity' },
    { header: 'Unit Cost', accessor: (row) => `$${row.costPrice.toFixed(2)}` },
    { header: 'Total Value', accessor: (row) => `$${row.value.toFixed(2)}` }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Inventory Aging Analysis</h2>
        </div>
        <Button onClick={() => onExport('aging-analysis', agingData)}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inventory Value by Age</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agingGroups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribution by Age Group</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={agingGroups}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {agingGroups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detailed Aging Report</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={agingData}
            columns={columns}
            searchPlaceholder="Search products..."
            pageSize={15}
          />
        </CardContent>
      </Card>
    </div>
  );
}