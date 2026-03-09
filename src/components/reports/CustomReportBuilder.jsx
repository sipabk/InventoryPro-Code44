import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Play, Settings2 } from 'lucide-react';
import DataTable from '../common/DataTable';
import { toast } from 'sonner';

const REPORT_SOURCES = {
  products: {
    label: 'Products',
    fields: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'quantity_in_stock', label: 'Qty in Stock', numeric: true },
      { key: 'unit_price', label: 'Unit Price', numeric: true },
      { key: 'cost_price', label: 'Cost Price', numeric: true },
      { key: 'reorder_level', label: 'Reorder Level', numeric: true },
      { key: 'tax_rate', label: 'Tax Rate', numeric: true },
      { key: 'unit_of_measure', label: 'Unit of Measure' },
    ]
  },
  transactions: {
    label: 'Stock Transactions',
    fields: [
      { key: 'transaction_number', label: 'Transaction #' },
      { key: 'type', label: 'Type' },
      { key: 'quantity', label: 'Quantity', numeric: true },
      { key: 'unit_cost', label: 'Unit Cost', numeric: true },
      { key: 'total_cost', label: 'Total Cost', numeric: true },
      { key: 'transaction_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'reference_number', label: 'Reference #' },
    ]
  }
};

export default function CustomReportBuilder({ products, transactions, categories, warehouses }) {
  const [source, setSource] = useState('products');
  const [selectedFields, setSelectedFields] = useState(['sku', 'name', 'quantity_in_stock', 'unit_price', 'status']);
  const [groupBy, setGroupBy] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportData, setReportData] = useState(null);

  const availableFields = REPORT_SOURCES[source]?.fields || [];

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const buildReport = () => {
    let rows = [];

    if (source === 'products') {
      rows = products.map(p => p.data || p).filter(p => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        return true;
      });
    } else {
      rows = transactions.map(t => t.data || t).filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
      });
    }

    const projected = rows.map(row => {
      const result = {};
      selectedFields.forEach(f => { result[f] = row[f] ?? '-'; });
      return result;
    });

    setReportData(projected);
    toast.success(`Report generated: ${projected.length} rows`);
  };

  const chartData = useMemo(() => {
    if (!reportData || !groupBy) return [];
    const grouped = {};
    const numericFields = availableFields.filter(f => f.numeric && selectedFields.includes(f.key));
    reportData.forEach(row => {
      const key = row[groupBy] || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = { name: key };
        numericFields.forEach(f => { grouped[key][f.key] = 0; });
      }
      numericFields.forEach(f => { grouped[key][f.key] += Number(row[f.key]) || 0; });
    });
    return Object.values(grouped).slice(0, 20);
  }, [reportData, groupBy, availableFields, selectedFields]);

  const exportCSV = () => {
    if (!reportData?.length) return;
    const headers = selectedFields.join(',');
    const rows = reportData.map(r => selectedFields.map(f => `"${r[f] ?? ''}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom-report-${Date.now()}.csv`;
    a.click();
    toast.success('Report exported');
  };

  const columns = selectedFields.map(f => {
    const fieldDef = availableFields.find(fd => fd.key === f);
    return { header: fieldDef?.label || f, accessor: f };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Data Source</Label>
              <Select value={source} onValueChange={(v) => { setSource(v); setSelectedFields([]); setReportData(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_SOURCES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  {source === 'transactions' && <>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group By (for chart)</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {availableFields.filter(f => !f.numeric && selectedFields.includes(f.key)).map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Select Fields to Include</Label>
            <div className="flex flex-wrap gap-3">
              {availableFields.map(f => (
                <label key={f.key} className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border hover:bg-slate-100 transition-colors">
                  <Checkbox
                    checked={selectedFields.includes(f.key)}
                    onCheckedChange={() => toggleField(f.key)}
                  />
                  <span className="text-sm">{f.label}</span>
                  {f.numeric && <Badge className="bg-blue-100 text-blue-700 text-xs">numeric</Badge>}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={buildReport} disabled={selectedFields.length === 0}>
              <Play className="w-4 h-4 mr-2" /> Generate Report
            </Button>
            {reportData && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          {groupBy && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chart — Grouped by {availableFields.find(f => f.key === groupBy)?.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {availableFields.filter(f => f.numeric && selectedFields.includes(f.key)).map((f, i) => (
                      <Bar key={f.key} dataKey={f.key} name={f.label} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Results — {reportData.length} rows</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={reportData.map((r, i) => ({ ...r, id: i }))}
                columns={columns}
                searchPlaceholder="Search results..."
                pageSize={20}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}