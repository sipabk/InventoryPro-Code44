import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, BarChart3, PieChart, TrendingUp, Shield, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { format, differenceInDays, subMonths } from 'date-fns';
import DataTable from '@/components/common/DataTable';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const [reportType, setReportType] = useState('stock_levels');

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.StockTransaction.list('-created_date', 500),
  });

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  // Stock Level Analysis
  const stockLevelData = products.map(p => ({
    name: p.name?.substring(0, 15) || 'Unknown',
    stock: p.quantity_in_stock || 0,
    reorder: p.reorder_level || 10,
    value: (p.quantity_in_stock || 0) * (p.cost_price || 0)
  })).slice(0, 10);

  // Stock by Category
  const categoryData = categories.map(cat => {
    const catName = cat.data?.name || cat.name || 'Unknown';
    const catProducts = products.filter(p => p.category_id === cat.id);
    const totalValue = catProducts.reduce((sum, p) => sum + ((p.quantity_in_stock || 0) * (p.cost_price || 0)), 0);
    return { name: catName, value: totalValue };
  }).filter(c => c.value > 0);

  // Movement Trends (Last 6 months)
  const movementData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const monthTx = transactions.filter(t => {
      const txDate = new Date(t.transaction_date || t.created_date);
      return txDate.getMonth() === month.getMonth() && txDate.getFullYear() === month.getFullYear();
    });
    return {
      name: format(month, 'MMM'),
      inward: monthTx.filter(t => t.type === 'inward').reduce((sum, t) => sum + (t.quantity || 0), 0),
      outward: monthTx.filter(t => t.type === 'outward').reduce((sum, t) => sum + (t.quantity || 0), 0)
    };
  });

  // Warranty Status
  const warrantyData = [
    { name: 'Active', value: warranties.filter(w => differenceInDays(new Date(w.end_date), new Date()) > 30).length },
    { name: 'Expiring Soon', value: warranties.filter(w => { const d = differenceInDays(new Date(w.end_date), new Date()); return d >= 0 && d <= 30; }).length },
    { name: 'Expired', value: warranties.filter(w => differenceInDays(new Date(w.end_date), new Date()) < 0).length },
  ];

  // Low Stock Items
  const lowStockItems = products.filter(p => (p.quantity_in_stock || 0) <= (p.reorder_level || 10));

  // Inventory Valuation
  const totalValue = products.reduce((sum, p) => sum + ((p.quantity_in_stock || 0) * (p.cost_price || 0)), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + ((p.quantity_in_stock || 0) * (p.unit_price || 0)), 0);

  const stockColumns = [
    { header: 'Product', accessor: 'name' },
    { header: 'SKU', accessor: 'sku' },
    { header: 'Stock', accessor: 'quantity_in_stock' },
    { header: 'Reorder Level', accessor: 'reorder_level' },
    { header: 'Cost', accessor: (row) => `BWP ${(row.cost_price || 0).toFixed(2)}` },
    { header: 'Value', accessor: (row) => `BWP ${((row.quantity_in_stock || 0) * (row.cost_price || 0)).toFixed(2)}` },
  ];

  const exportCSV = (data, filename) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Inventory analytics and insights</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Inventory Value</p>
                <p className="text-2xl font-bold">BWP {totalValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Retail Value</p>
                <p className="text-2xl font-bold">BWP {totalRetailValue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Low Stock Items</p>
                <p className="text-2xl font-bold">{lowStockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          <TabsTrigger value="movement">Movement Trends</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="warranty">Warranties</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stock Level Analysis</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCSV(products, 'stock-levels')}>
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockLevelData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="stock" fill="#3b82f6" name="Current Stock" />
                    <Bar dataKey="reorder" fill="#f59e0b" name="Reorder Level" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable 
                data={lowStockItems} 
                columns={stockColumns} 
                emptyMessage="No low stock items"
                pageSize={5}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movement">
          <Card>
            <CardHeader>
              <CardTitle>Stock Movement Trends (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={movementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="inward" stroke="#10b981" strokeWidth={2} name="Inward" />
                    <Line type="monotone" dataKey="outward" stroke="#ef4444" strokeWidth={2} name="Outward" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Value by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `BWP ${value.toLocaleString()}`} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warranty">
          <Card>
            <CardHeader>
              <CardTitle>Warranty Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={warrantyData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
