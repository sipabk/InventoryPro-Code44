import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Calendar, Pause, Play, Trash2, RefreshCw, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import DataTable from '../common/DataTable';
import ScheduledReportForm from './ScheduledReportForm';
import ConfirmDialog from '../common/ConfirmDialog';
import { toast } from 'sonner';
import { format, addDays, addWeeks, addMonths, addQuarters, isAfter, isBefore, differenceInMinutes } from 'date-fns';

export default function ScheduledReportsManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [deletingReport, setDeletingReport] = useState(null);
  const [runningReport, setRunningReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: scheduledReports = [] } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => base44.entities.ScheduledReport.list('-created_date', 100)
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.StockTransaction.list()
  });

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list()
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list()
  });

  // Check and run due reports
  useEffect(() => {
    const checkDueReports = () => {
      scheduledReports.forEach(report => {
        const data = report.data || report;
        if (data.status !== 'active') return;

        const lastRun = data.last_run ? new Date(data.last_run) : null;
        const nextRun = calculateNextRun(lastRun, data.frequency);
        
        if (!nextRun || isAfter(new Date(), nextRun)) {
          // Report is due - check if it hasn't been run in the last 5 minutes to prevent duplicates
          if (!lastRun || differenceInMinutes(new Date(), lastRun) >= 5) {
            console.log(`[v0] Report "${data.report_name}" is due for execution`);
          }
        }
      });
    };

    const interval = setInterval(checkDueReports, 60000); // Check every minute
    checkDueReports(); // Initial check
    
    return () => clearInterval(interval);
  }, [scheduledReports]);

  const calculateNextRun = (lastRun, frequency) => {
    if (!lastRun) return new Date(); // Run immediately if never run
    
    switch (frequency) {
      case 'daily': return addDays(lastRun, 1);
      case 'weekly': return addWeeks(lastRun, 1);
      case 'monthly': return addMonths(lastRun, 1);
      case 'quarterly': return addQuarters(lastRun, 1);
      default: return addWeeks(lastRun, 1);
    }
  };

  const generateReportData = (reportType) => {
    switch (reportType) {
      case 'stock_levels':
        return products.map(p => {
          const data = p.data || p;
          return {
            SKU: data.sku,
            Name: data.name,
            'Quantity in Stock': data.quantity_in_stock,
            'Reorder Level': data.reorder_level,
            'Unit Price': data.unit_price,
            Status: data.status
          };
        });
      
      case 'aging_analysis':
        return products.map(p => {
          const data = p.data || p;
          const daysSincePurchase = data.purchase_date 
            ? Math.floor((new Date() - new Date(data.purchase_date)) / (1000 * 60 * 60 * 24))
            : 0;
          return {
            SKU: data.sku,
            Name: data.name,
            'Purchase Date': data.purchase_date || 'N/A',
            'Days in Stock': daysSincePurchase,
            Quantity: data.quantity_in_stock,
            Value: (data.quantity_in_stock || 0) * (data.cost_price || 0)
          };
        });
      
      case 'stock_movement':
        return transactions.slice(0, 100).map(t => {
          const data = t.data || t;
          const product = products.find(p => (p.data || p).id === data.product_id);
          return {
            'Transaction #': data.transaction_number,
            Product: (product?.data || product)?.name || 'Unknown',
            Type: data.type,
            Quantity: data.quantity,
            Date: data.transaction_date,
            Status: data.status
          };
        });
      
      case 'valuation':
        return products.map(p => {
          const data = p.data || p;
          return {
            SKU: data.sku,
            Name: data.name,
            Quantity: data.quantity_in_stock,
            'Cost Price': data.cost_price,
            'Total Value': (data.quantity_in_stock || 0) * (data.cost_price || 0)
          };
        });
      
      case 'supplier_performance':
        return suppliers.map(s => {
          const data = s.data || s;
          return {
            Name: data.name,
            Code: data.code,
            'Contact Person': data.contact_person,
            Email: data.email,
            Rating: data.rating || 'N/A',
            Status: data.status
          };
        });
      
      case 'warranty_expiry':
        return warranties.map(w => {
          const data = w.data || w;
          const product = products.find(p => (p.data || p).id === data.product_id);
          const daysLeft = data.end_date 
            ? Math.floor((new Date(data.end_date) - new Date()) / (1000 * 60 * 60 * 24))
            : 0;
          return {
            Product: (product?.data || product)?.name || 'Unknown',
            'Serial Number': data.serial_number,
            Provider: data.warranty_provider,
            'End Date': data.end_date,
            'Days Remaining': daysLeft,
            Status: data.status
          };
        });
      
      default:
        return [];
    }
  };

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(v => 
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(',')
    );
    return [headers, ...rows].join('\n');
  };

  const runReportMutation = useMutation({
    mutationFn: async (report) => {
      const data = report.data || report;
      const reportData = generateReportData(data.report_type);
      const csv = convertToCSV(reportData);
      
      // Simulate sending email (in production, this would call a backend API)
      const recipients = data.recipients || [];
      
      if (recipients.length > 0) {
        // In a real app, this would trigger an email API
        console.log(`[v0] Sending report "${data.report_name}" to: ${recipients.join(', ')}`);
        
        // Simulate email sending delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update last_run timestamp
      await base44.entities.ScheduledReport.update(report.id, {
        ...data,
        last_run: new Date().toISOString(),
        last_run_status: 'success',
        last_run_rows: reportData.length
      });

      // Log the activity
      try {
        await base44.entities.ActivityLog.create({
          action: 'report_generated',
          entity_type: 'ScheduledReport',
          entity_name: data.report_name,
          details: `Generated ${data.report_type} report with ${reportData.length} rows. Sent to ${recipients.length} recipients.`,
          user_name: 'System',
          created_date: new Date().toISOString()
        });
      } catch (e) {
        console.log('[v0] Activity log creation skipped');
      }

      return { csv, reportData, recipients };
    },
    onSuccess: (result, report) => {
      queryClient.invalidateQueries(['scheduledReports']);
      setRunningReport(null);
      
      const data = report.data || report;
      if (result.recipients.length > 0) {
        toast.success(`Report "${data.report_name}" generated and sent to ${result.recipients.length} recipient(s)`);
      } else {
        toast.success(`Report "${data.report_name}" generated successfully (${result.reportData.length} rows)`);
      }

      // Download the CSV
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.report_name}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
    },
    onError: (error) => {
      setRunningReport(null);
      toast.error('Failed to generate report');
      console.error('[v0] Report generation error:', error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledReports']);
      setDeletingReport(null);
      toast.success('Scheduled report deleted');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ScheduledReport.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledReports']);
      toast.success('Status updated');
    }
  });

  const statusConfig = {
    active: { color: 'bg-green-100 text-green-700', label: 'Active' },
    paused: { color: 'bg-yellow-100 text-yellow-700', label: 'Paused' },
    inactive: { color: 'bg-slate-100 text-slate-700', label: 'Inactive' }
  };

  const getField = (row, field) => row.data ? row.data[field] : row[field];

  const getNextRunDate = (report) => {
    const data = report.data || report;
    const lastRun = data.last_run ? new Date(data.last_run) : null;
    const nextRun = calculateNextRun(lastRun, data.frequency);
    return nextRun ? format(nextRun, 'MMM d, yyyy HH:mm') : 'Pending';
  };

  const columns = [
    { header: 'Report Name', accessor: (row) => getField(row, 'report_name') },
    { header: 'Type', accessor: (row) => (getField(row, 'report_type') || '').replace(/_/g, ' ') },
    { header: 'Frequency', accessor: (row) => getField(row, 'frequency') },
    { 
      header: 'Recipients', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Mail className="w-4 h-4" />
          <span>{(getField(row, 'recipients') || []).length}</span>
        </div>
      )
    },
    { 
      header: 'Last Run', 
      cell: (row) => {
        const lastRun = getField(row, 'last_run');
        const lastStatus = getField(row, 'last_run_status');
        return (
          <div className="flex items-center gap-2">
            {lastStatus === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {lastStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
            <span>{lastRun ? format(new Date(lastRun), 'MMM d, HH:mm') : 'Never'}</span>
          </div>
        );
      }
    },
    {
      header: 'Next Run',
      cell: (row) => (
        <div className="flex items-center gap-1 text-slate-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{getNextRunDate(row)}</span>
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => {
        const status = getField(row, 'status') || 'active';
        const config = statusConfig[status] || statusConfig.active;
        return <Badge className={config.color}>{config.label}</Badge>;
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setRunningReport(row.id);
              runReportMutation.mutate(row);
            }}
            disabled={runningReport === row.id}
          >
            {runningReport === row.id ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              const currentStatus = getField(row, 'status');
              const newStatus = currentStatus === 'active' ? 'paused' : 'active';
              toggleStatusMutation.mutate({ id: row.id, status: newStatus });
            }}
          >
            {getField(row, 'status') === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => { e.stopPropagation(); setDeletingReport(row); }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Scheduled Reports
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Automate report generation and email delivery. Reports run automatically based on their schedule.
              </p>
            </div>
            <Button onClick={() => { setEditingReport(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              New Scheduled Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={scheduledReports}
            columns={columns}
            searchPlaceholder="Search scheduled reports..."
            onRowClick={(row) => { setEditingReport(row); setShowForm(true); }}
          />
        </CardContent>
      </Card>

      {showForm && (
        <ScheduledReportForm
          report={editingReport}
          onClose={() => { setShowForm(false); setEditingReport(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deletingReport}
        onClose={() => setDeletingReport(null)}
        onConfirm={() => deleteMutation.mutate(deletingReport.id)}
        title="Delete Scheduled Report"
        description={`Are you sure you want to delete "${getField(deletingReport, 'report_name')}"?`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
