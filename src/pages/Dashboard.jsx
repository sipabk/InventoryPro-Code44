import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Package, Warehouse, Users, AlertTriangle, TrendingUp, ArrowRightLeft, Shield, DollarSign } from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import InventoryChart from '@/components/dashboard/InventoryChart';
import StockPieChart from '@/components/dashboard/StockPieChart';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import WarrantyAlerts from '@/components/dashboard/WarrantyAlerts';
import LowStockAlerts from '@/components/dashboard/LowStockAlerts';
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays } from 'date-fns';

export default function Dashboard() {
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.StockTransaction.list('-created_date', 50),
  });

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  // Calculate stats
  const totalStock = products.reduce((sum, p) => sum + (p.quantity_in_stock || 0), 0);
  const totalValue = products.reduce((sum, p) => sum + ((p.quantity_in_stock || 0) * (p.cost_price || 0)), 0);
  const lowStockItems = products.filter(p => (p.quantity_in_stock || 0) <= (p.reorder_level || 10)).length;
  const expiringWarranties = warranties.filter(w => {
    const days = differenceInDays(new Date(w.end_date), new Date());
    return days >= 0 && days <= 30;
  }).length;

  // Chart data
  const categoryData = products.reduce((acc, p) => {
    const cat = p.category_id || 'Uncategorized';
    acc[cat] = (acc[cat] || 0) + (p.quantity_in_stock || 0);
    return acc;
  }, {});

  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

  const monthlyData = [
    { name: 'Jan', inward: 120, outward: 80 },
    { name: 'Feb', inward: 150, outward: 95 },
    { name: 'Mar', inward: 180, outward: 120 },
    { name: 'Apr', inward: 140, outward: 110 },
    { name: 'May', inward: 200, outward: 150 },
    { name: 'Jun', inward: 170, outward: 130 },
  ];

  if (loadingProducts) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Inventory overview and insights</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Stock"
          value={totalStock.toLocaleString()}
          icon={Package}
          color="blue"
          subtitle={`${products.length} products`}
        />
        <StatsCard
          title="Total Value"
          value={`BWP ${totalValue.toLocaleString()}`}
          icon={DollarSign}
          color="emerald"
          subtitle="Inventory value"
        />
        <StatsCard
          title="Low Stock"
          value={lowStockItems}
          icon={AlertTriangle}
          color="amber"
          subtitle="Items need reorder"
        />
        <StatsCard
          title="Expiring Warranties"
          value={expiringWarranties}
          icon={Shield}
          color="red"
          subtitle="Within 30 days"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InventoryChart data={monthlyData} />
        <StockPieChart data={pieData} />
      </div>

      {/* Alerts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LowStockAlerts products={products} />
        <WarrantyAlerts warranties={warranties} products={products} />
        <RecentTransactions transactions={transactions} products={products} />
      </div>
    </div>
  );
}
