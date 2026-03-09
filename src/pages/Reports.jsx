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
    { header: 'Cost', accessor: (row) => `$${(row.cost_price || 0).toFixed(2)}` },
 