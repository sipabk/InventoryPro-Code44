import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Save, Calendar, Clock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, addWeeks, addMonths, addQuarters, format, setHours, setMinutes, startOfDay } from 'date-fns';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function ScheduledReportForm({ report, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    report_name: '',
    report_type: 'stock_levels',
    frequency: 'weekly',
    day_of_week: 1, // Monday
    day_of_month: 1,
    time_of_day: '08:00',
    recipients: [],
    status: 'active',
    filters: {},
    next_run: '',
    include_products: [], // For product selection
    warehouse_filter: 'all',
    category_filter: 'all',
  });

  const [newRecipient, setNewRecipient] = useState('');

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  useEffect(() => {
    if (report) {
      setFormData(report.data || report);
    }
  }, [report]);

  // Calculate next run date based on frequency
  const calculateNextRun = (data) => {
    const now = new Date();
    let nextRun = startOfDay(now);
    
    // Set the time
    const [hours, minutes] = (data.time_of_day || '08:00').split(':').map(Number);
    nextRun = setHours(setMinutes(nextRun, minutes), hours);
    
    // If the time today has passed, start from tomorrow
    if (nextRun <= now) {
      nextRun = addDays(nextRun, 1);
    }
    
    switch (data.frequency) {
      case 'daily':
        // Already set above
        break;
      case 'weekly':
        // Find next occurrence of the specified day
        while (nextRun.getDay() !== (data.day_of_week || 1)) {
          nextRun = addDays(nextRun, 1);
        }
        break;
      case 'monthly':
        // Set to specified day of month
        nextRun.setDate(data.day_of_month || 1);
        if (nextRun <= now) {
          nextRun = addMonths(nextRun, 1);
        }
        break;
      case 'quarterly':
        nextRun.setDate(data.day_of_month || 1);
        const currentQuarter = Math.floor(now.getMonth() / 3);
        nextRun.setMonth(currentQuarter * 3 + 3); // Start of next quarter
        if (nextRun <= now) {
          nextRun = addQuarters(nextRun, 1);
        }
        break;
    }
    
    return nextRun.toISOString();
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dataToSave = {
        ...formData,
        next_run: calculateNextRun(formData),
        last_run: report?.last_run || null,
      };
      
      if (report) {
        await base44.entities.ScheduledReport.update(report.id, dataToSave);
      } else {
        await base44.entities.ScheduledReport.create(dataToSave);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledReports']);
      toast.success(report ? 'Report updated' : 'Report scheduled');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to save: ' + (error.message || 'Unknown error'));
    }
  });

  const addRecipient = () => {
    if (newRecipient && /\S+@\S+\.\S+/.test(newRecipient)) {
      setFormData({
        ...formData,
        recipients: [...(formData.recipients || []), newRecipient]
      });
      setNewRecipient('');
    } else {
      toast.error('Please enter a valid email address');
    }
  };

  const removeRecipient = (email) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(r => r !== email)
    });
  };

  // Preview next run date
  const previewNextRun = calculateNextRun(formData);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report ? 'Edit Scheduled Report' : 'New Scheduled Report'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Report Name *</Label>
            <Input
              value={formData.report_name}
              onChange={(e) => setFormData({ ...formData, report_name: e.target.value })}
              placeholder="e.g., Weekly Stock Summary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Report Type *</Label>
              <Select value={formData.report_type} onValueChange={(v) => setFormData({ ...formData, report_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_levels">Stock Levels</SelectItem>
                  <SelectItem value="aging_analysis">Aging Analysis</SelectItem>
                  <SelectItem value="stock_movement">Stock Movement</SelectItem>
                  <SelectItem value="valuation">Valuation Report</SelectItem>
                  <SelectItem value="supplier_performance">Supplier Performance</SelectItem>
                  <SelectItem value="warranty_expiry">Warranty Expiry</SelectItem>
                  <SelectItem value="low_stock">Low Stock Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequency *</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4" /> Schedule Configuration
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {formData.frequency === 'weekly' && (
                <div>
                  <Label>Day of Week</Label>
                  <Select value={String(formData.day_of_week)} onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {(formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
                <div>
                  <Label>Day of Month</Label>
                  <Select value={String(formData.day_of_month)} onValueChange={(v) => setFormData({ ...formData, day_of_month: parseInt(v) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div>
                <Label>Time of Day</Label>
                <Input 
                  type="time" 
                  value={formData.time_of_day}
                  onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4" />
              Next scheduled run: <span className="font-medium">{format(new Date(previewNextRun), 'EEEE, MMMM d, yyyy \'at\' h:mm a')}</span>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Warehouse Filter</Label>
              <Select value={formData.warehouse_filter || 'all'} onValueChange={(v) => setFormData({ ...formData, warehouse_filter: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category Filter</Label>
              <Select value={formData.category_filter || 'all'} onValueChange={(v) => setFormData({ ...formData, category_filter: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email Recipients
            </Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="email@example.com"
                onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
              />
              <Button onClick={addRecipient} size="sm" type="button">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(formData.recipients || []).map((email, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-sm">
                  {email}
                  <button type="button" onClick={() => removeRecipient(email)} className="ml-1 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {(formData.recipients || []).length === 0 && (
              <p className="text-xs text-slate-500 mt-1">Add at least one email recipient to receive reports</p>
            )}
          </div>

          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button 
              onClick={() => saveMutation.mutate()} 
              disabled={saveMutation.isPending || !formData.report_name || (formData.recipients || []).length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
