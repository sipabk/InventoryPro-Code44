import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Package, Clock, Download, Mail } from 'lucide-react';
import { toast } from 'sonner';
import AgingAnalysisReport from '../components/reports/AgingAnalysisReport';
import StockMovementReport from '../components/reports/StockMovementReport';
import ScheduledReportsManager from '../components/reports/ScheduledReportsManager';
import ValuationReport from '../components/reports/ValuationReport';
import CustomReportBuilder from '../components/reports/CustomReportBuilder';

export default function AdvancedReports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('name', 500)
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list('name', 500)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name', 500)
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['stockTransactions'],
    queryFn: () => base44.entities.StockTransaction.list('-transaction_date', 1000)
  });

  const exportReport = (reportName, data) => {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported successfully');
  };

  const convertToCSV = (data) => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Advanced Reports</h1>
        <p className="text-slate-500 mt-1">Generate detailed reports with custom filters and scheduling</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label>Warehouse</Label>
 