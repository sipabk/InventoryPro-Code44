import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import DataTable from '../common/DataTable';

export default function StockMovementReport({ products, transactions, warehouses, dateFrom, dateTo, warehouseFilter, onExport }) {
  const movementData = useMemo(() => {
    let filtered = transactions.filter(t => {
      const td = t.data || t;
      if (warehouseFilter !== 'all' && td.warehouse_id !== warehouseFilter) return false;
      if (dateFrom && td.transaction_date < dateFrom) return false;
      if (dateTo && td.transaction_date > dateTo) return false;
      return true;
    });

    return filtered.map(txn => {
      const td = txn.data || txn;
      const product = products.find(p => p.id === td.product_id);
      const warehouse = warehouses.find(w => w.id === td.warehouse_id);
      const pd = product?.data || product;
      const wd = warehouse?.data || warehouse;
      
      return {
        date: td.transaction_date,
        transactionNumber: td.transaction_number,
        product: pd?.name || 'N/A',
        warehouse: wd?.name || 'N/A',
        type: td.type,
        quantity: td.quantity,
        unitCost: td.unit_cost || 0,
        totalCost: td.total_cost || 0,
        status: td.status
      };
    });
  }, [transactions, products, warehouses, dateFrom, dateTo, warehouseFilter]);

  const trendData = useMemo(() => {
    const grouped = {};
    movementData.forEach(item => {
      if (!grouped[item.date]) {
        grouped[item.date] = { date: item.date, inward: 0, outward: 0 };
      }
      if (item.type === 'inward') {
        grouped[item.date].inward += item.quantity;
      } else if (item.type === 'outward') {
        grouped[item.date].outward += item.quantity;
      }
    });
    
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [movementData]);

  const columns = [
    { header: 'Date', accessor: 'date' },
    { header: 'Transaction #', accessor: 'transactionNumber' },
    { header: 'Product', accessor: 'product' },
    { header: 'Warehouse', accessor: 'warehouse' },
    { 
      header: 'Type', 
      cell: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          row.type === 'inward' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {row.type}
        </span>
      )
    },
    { header: 'Quantity', accessor: 'quantity' },
    { header: 'Unit Cost', accessor: (row) => `$${row.unitCost.toFixed(2)}` },
    { header: 'Total Value', accessor: (row) => `$${row.totalCost.toFixed(2)}` }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-600" />
          <h2 className="text-xl font-semibold">Stock Movement History</h2>
        </div>
        <Button onClick={() => onExport('stock-movement', movementData)}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Movement Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="inward" stroke="#10b981" name="Inward" strokeWidth={2} />
              <Line type="monotone" dataKey="outward" stroke="#ef4444" name="Outward" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={movementData}
            columns={columns}
            searchPlaceholder="Search transactions..."
            pageSize={15}
          />
        </CardContent>
      </Card>
    </div>
  );
}