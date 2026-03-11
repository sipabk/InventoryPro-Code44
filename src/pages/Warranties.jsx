import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Shield, AlertTriangle, CheckCircle, XCircle, Clock, Download } from "lucide-react";
import { format, differenceInDays, addMonths } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";

const WARRANTY_TYPES = ['manufacturer', 'extended', 'third_party', 'in_house'];
const STATUSES = ['active', 'expired', 'expiring_soon', 'claimed', 'void'];

const statusConfig = {
  active: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  expiring_soon: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700' },
  expired: { icon: XCircle, color: 'bg-red-100 text-red-700' },
  claimed: { icon: Clock, color: 'bg-blue-100 text-blue-700' },
  void: { icon: XCircle, color: 'bg-slate-100 text-slate-700' },
};

const initialWarranty = {
  product_id: '', serial_number: '', warranty_provider: '', provider_contact: '',
  provider_email: '', provider_phone: '', start_date: '', end_date: '',
  duration_months: 12, warranty_type: 'manufacturer', coverage_details: '',
  terms_conditions: '', status: 'active', document_url: ''
};

export default function Warranties() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState(null);
  const [formData, setFormData] = useState(initialWarranty);
  
  const queryClient = useQueryClient();

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Warranty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Warranty.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Warranty.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setDeleteOpen(false);
      toast.success('Warranty deleted successfully');
    },
  });

  const handleSubmit = () => {
    // Auto-calculate status
    const daysLeft = differenceInDays(new Date(formData.end_date), new Date());
    let status = formData.status;
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 30) status = 'expiring_soon';
    else if (status !== 'claimed' && status !== 'void') status = 'active';

    const dataToSave = { ...formData, status };
    if (editingWarranty) {
      updateMutation.mutate({ id: editingWarranty.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const openCreate = () => {
    setEditingWarranty(null);
    setFormData(initialWarranty);
    setModalOpen(true);
  };

  const openEdit = (warranty) => {
    setEditingWarranty(warranty);
    setFormData(warranty);
    setModalOpen(true);
  };

  const handleStartDateChange = (date) => {
    const startDate = new Date(date);
    const endDate = addMonths(startDate, formData.duration_months);
    setFormData({ 
      ...formData, 
      start_date: date, 
      end_date: endDate.toISOString().split('T')[0] 
    });
  };

  const handleDurationChange = (months) => {
    if (formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = addMonths(startDate, months);
      setFormData({ 
        ...formData, 
        duration_months: months, 
        end_date: endDate.toISOString().split('T')[0] 
      });
    } else {
      setFormData({ ...formData, duration_months: months });
    }
  };

  const columns = [
    { 
      header: 'Product', 
      cell: (row) => {
        const product = products.find(p => p.id === row.product_id);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{product?.name || 'Unknown'}</p>
              <p className="text-xs text-slate-500">S/N: {row.serial_number || '-'}</p>
            </div>
          </div>
        );
      }
    },
    { header: 'Provider', accessor: 'warranty_provider' },
    { header: 'Type', accessor: (row) => row.warranty_type?.replace('_', ' ') },
    { 
      header: 'Period', 
      cell: (row) => (
        <div className="text-sm">
          <p>{row.start_date ? format(new Date(row.start_date), 'MMM d, yyyy') : '-'}</p>
          <p className="text-slate-500">to {row.end_date ? format(new Date(row.end_date), 'MMM d, yyyy') : '-'}</p>
        </div>
      )
    },
    { 
      header: 'Days Left', 
      cell: (row) => {
        const days = differenceInDays(new Date(row.end_date), new Date());
        return (
          <span className={days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-emerald-600'}>
            {days <= 0 ? 'Expired' : `${days} days`}
          </span>
        );
      }
    },
    { 
      header: 'Status', 
      cell: (row) => {
        const config = statusConfig[row.status] || statusConfig.active;
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {row.status}
          </Badge>
        );
      }
    },
    { 
      header: 'Actions', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditingWarranty(row); setDeleteOpen(true); }}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Warranties</h1>
          <p className="text-slate-500 mt-1">Track product warranties</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Warranty
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={warranties} 
          columns={columns} 
          searchPlaceholder="Search warranties..." 
          emptyMessage="No warranties found"
        />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWarranty ? 'Edit Warranty' : 'Add Warranty'}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Product</Label>
            <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Serial Number</Label>
            <Input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
          </div>
          <div>
            <Label>Warranty Provider</Label>
            <Input value={formData.warranty_provider} onChange={(e) => setFormData({ ...formData, warranty_provider: e.target.value })} />
          </div>
          <div>
            <Label>Warranty Type</Label>
            <Select value={formData.warranty_type} onValueChange={(v) => setFormData({ ...formData, warranty_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARRANTY_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provider Contact</Label>
            <Input value={formData.provider_contact} onChange={(e) => setFormData({ ...formData, provider_contact: e.target.value })} />
          </div>
          <div>
            <Label>Provider Email</Label>
            <Input value={formData.provider_email} onChange={(e) => setFormData({ ...formData, provider_email: e.target.value })} />
          </div>
          <div>
            <Label>Provider Phone</Label>
            <Input value={formData.provider_phone} onChange={(e) => setFormData({ ...formData, provider_phone: e.target.value })} />
          </div>
          <div>
            <Label>Duration (months)</Label>
            <Input type="number" value={formData.duration_months} onChange={(e) => handleDurationChange(Number(e.target.value))} />
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={formData.start_date} onChange={(e) => handleStartDateChange(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Coverage Details</Label>
            <Textarea value={formData.coverage_details} onChange={(e) => setFormData({ ...formData, coverage_details: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Terms & Conditions</Label>
            <Textarea value={formData.terms_conditions} onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })} />
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(editingWarranty?.id)}
        title="Delete Warranty"
        description="Are you sure you want to delete this warranty record? This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
