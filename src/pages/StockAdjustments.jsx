import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, X, Settings2, Calculator, Download } from "lucide-react";
import { format } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import { toast } from "sonner";

const ADJUSTMENT_TYPES = ['stock_take', 'damage', 'loss', 'correction', 'opening_balance', 'closing_balance'];
const VALUATION_METHODS = ['fifo', 'lifo', 'weighted_average'];

const initialAdjustment = {
  product_id: '', warehouse_id: '', adjustment_type: 'correction',
  valuation_method: 'weighted_average', previous_quantity: 0, new_quantity: 0,
  variance: 0, previous_value: 0, new_value: 0, value_variance: 0,
  reason: '', financial_year: new Date().getFullYear().toString(),
  status: 'draft', adjustment_date: ''
};

export default function StockAdjustments() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialAdjustment);

  const queryClient = useQueryClient();

  const { data: adjustments = [] } = useQuery({
    queryKey: ['adjustments'],
    queryFn: () => base44.entities.StockAdjustment.list('-created_date', 100),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const adjNumber = `ADJ-${Date.now()}`;
      return base44.entities.StockAdjustment.create({ ...data, adjustment_number: adjNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      setModalOpen(false);
      toast.success('Adjustment created successfully');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status, adjustment }) => {
      const result = await base44.entities.StockAdjustment.update(id, {
        status,
        approved_by: 'current_user',
        approved_date: new Date().toISOString()
      });

      // If approved, update product stock
      if (status === 'approved' && adjustment) {
        const prodId = adjustment.product_id;
        if (prodId) {
          await base44.entities.Product.update(prodId, {
            quantity_in_stock: adjustment.new_quantity
          });
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Adjustment status updated');
    },
  });

  const handleProductChange = (productId) => {
    const p = products.find(p => p.id === productId);
    const product = p || {};
    const qty = product.quantity_in_stock || 0;
    const cost = product.cost_price || 0;
    setFormData({
      ...formData,
      product_id: productId,
      previous_quantity: qty,
      new_quantity: qty,
      variance: 0,
      previous_value: qty * cost,
      new_value: qty * cost,
      value_variance: 0
    });
  };

  const handleQuantityChange = (newQty) => {
    const p = products.find(p => p.id === formData.product_id);
    const costPrice = p?.cost_price || 0;
    const variance = newQty - formData.previous_quantity;
    const newValue = newQty * costPrice;
    const valueVariance = newValue - formData.previous_value;

    setFormData({
      ...formData,
      new_quantity: newQty,
      variance,
      new_value: newValue,
      value_variance: valueVariance
    });
  };

  const handleSubmit = () => {
    createMutation.mutate({ ...formData, status: 'pending_approval' });
  };

  const openCreate = () => {
    setFormData({ ...initialAdjustment, adjustment_date: format(new Date(), 'yyyy-MM-dd') });
    setModalOpen(true);
  };

  const columns = [
    {
      header: 'Adjustment',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Settings2 className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{row.adjustment_number}</p>
            <p className="text-xs text-slate-500 capitalize">{row.adjustment_type?.replace('_', ' ')}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Product',
      accessor: (row) => { const p = products.find(p => p.id === row.product_id); return p?.data?.name || p?.name || '-'; }
    },
    {
      header: 'Warehouse',
      accessor: (row) => { const w = warehouses.find(w => w.id === row.warehouse_id); return w?.data?.name || w?.name || '-'; }
    },
    {
      header: 'Previous Qty',
      accessor: 'previous_quantity'
    },
    {
      header: 'New Qty',
      accessor: 'new_quantity'
    },
    {
      header: 'Variance',
      cell: (row) => (
        <span className={`font-semibold ${row.variance > 0 ? 'text-emerald-600' : row.variance < 0 ? 'text-red-600' : 'text-slate-600'}`}>
          {row.variance > 0 ? '+' : ''}{row.variance}
        </span>
      )
    },
    {
      header: 'Value Variance',
      cell: (row) => (
        <span className={`font-semibold ${row.value_variance > 0 ? 'text-emerald-600' : row.value_variance < 0 ? 'text-red-600' : 'text-slate-600'}`}>
          ${(row.value_variance || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge className={
          row.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
            row.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
              row.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-700'
        }>
          {row.status?.replace('_', ' ')}
        </Badge>
      )
    },
    {
      header: 'Actions',
      cell: (row) => row.status === 'pending_approval' && (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate({ id: row.id, status: 'approved', adjustment: row })}>
            <Check className="w-4 h-4 text-emerald-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate({ id: row.id, status: 'rejected' })}>
            <X className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="text-slate-500 mt-1">Reconciliation and stock corrections</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Adjustment
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable data={adjustments} columns={columns} searchPlaceholder="Search adjustments..." />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Stock Adjustment"
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Adjustment Type *</Label>
            <Select value={formData.adjustment_type} onValueChange={(v) => setFormData({ ...formData, adjustment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valuation Method</Label>
            <Select value={formData.valuation_method} onValueChange={(v) => setFormData({ ...formData, valuation_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALUATION_METHODS.map(m => <SelectItem key={m} value={m} className="uppercase">{m.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select value={formData.product_id} onValueChange={handleProductChange}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.data?.name || p.name} ({p.data?.sku || p.sku})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Warehouse</Label>
            <Select value={formData.warehouse_id} onValueChange={(v) => setFormData({ ...formData, warehouse_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
              <SelectContent>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.data?.name || w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Previous Quantity</Label>
            <Input type="number" value={formData.previous_quantity} disabled className="bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label>New Quantity *</Label>
            <Input type="number" value={formData.new_quantity} onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Quantity Variance</Label>
            <Input value={formData.variance > 0 ? `+${formData.variance}` : formData.variance} disabled className="bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label>Value Variance</Label>
            <Input value={`$${(formData.value_variance || 0).toFixed(2)}`} disabled className="bg-slate-50" />
          </div>
          <div className="space-y-2">
            <Label>Adjustment Date</Label>
            <Input type="date" value={formData.adjustment_date} onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Financial Year</Label>
            <Input value={formData.financial_year} onChange={(e) => setFormData({ ...formData, financial_year: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Reason *</Label>
            <Textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Explain the reason for this adjustment..." />
          </div>
        </div>
      </FormModal>
    </div>
  );
}