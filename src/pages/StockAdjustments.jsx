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

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

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
    const product = products.find(p => p.id === productId);
    if (product) {
      const previousQty = product.quantity_in_stock || 0;
      const previousValue = previousQty * (product.cost_price || 0);
      setFormData({
        ...formData,
        product_id: productId,
        previous_quantity: previousQty,
        previous_value: previousValue,
        new_quantity: previousQty,
        new_value: previousValue,
        variance: 0,
        value_variance: 0,
      });
    }
  };

  const handleNewQuantityChange = (newQty) => {
    const product = products.find(p => p.id === formData.product_id);
    const costPrice = product?.cost_price || 0;
    const newValue = newQty * costPrice;
    const variance = newQty - formData.previous_quantity;
    const valueVariance = newValue - formData.previous_value;
    
    setFormData({
      ...formData,
      new_quantity: newQty,
      new_value: newValue,
      variance,
      value_variance: valueVariance,
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      adjustment_date: formData.adjustment_date || new Date().toISOString().split('T')[0]
    };
    createMutation.mutate(data);
  };

  const openCreate = () => {
    setFormData({
      ...initialAdjustment,
      adjustment_date: new Date().toISOString().split('T')[0]
    });
    setModalOpen(true);
  };

  const getProductName = (id) => products.find(p => p.id === id)?.name || '-';
  const getWarehouseName = (id) => warehouses.find(w => w.id === id)?.name || '-';

  const columns = [
    { 
      header: 'Adjustment', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{row.adjustment_number}</p>
            <p className="text-xs text-slate-500">{row.adjustment_type?.replace('_', ' ')}</p>
          </div>
        </div>
      )
    },
    { header: 'Product', accessor: (row) => getProductName(row.product_id) },
    { header: 'Warehouse', accessor: (row) => getWarehouseName(row.warehouse_id) },
    { 
      header: 'Variance', 
      cell: (row) => (
        <span className={row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {row.variance >= 0 ? '+' : ''}{row.variance}
        </span>
      )
    },
    { 
      header: 'Date', 
      accessor: (row) => row.adjustment_date ? format(new Date(row.adjustment_date), 'MMM d, yyyy') : '-'
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <Badge className={statusColors[row.status] || statusColors.draft}>
          {row.status}
        </Badge>
      )
    },
    { 
      header: 'Actions', 
      cell: (row) => row.status === 'draft' && (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => approveMutation.mutate({ id: row.id, status: 'approved', adjustment: row })}
          >
            <Check className="w-4 h-4 text-emerald-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => approveMutation.mutate({ id: row.id, status: 'rejected', adjustment: row })}
          >
            <X className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="text-slate-500 mt-1">Manage inventory corrections</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Adjustment
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={adjustments} 
          columns={columns} 
          searchPlaceholder="Search adjustments..." 
          emptyMessage="No adjustments found"
        />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Stock Adjustment"
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Product</Label>
            <Select value={formData.product_id} onValueChange={handleProductChange}>
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
            <Label>Warehouse</Label>
            <Select value={formData.warehouse_id} onValueChange={(v) => setFormData({ ...formData, warehouse_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Adjustment Type</Label>
            <Select value={formData.adjustment_type} onValueChange={(v) => setFormData({ ...formData, adjustment_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Adjustment Date</Label>
            <Input 
              type="date" 
              value={formData.adjustment_date} 
              onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })} 
            />
          </div>
          <div>
            <Label>Previous Quantity</Label>
            <Input type="number" value={formData.previous_quantity} disabled />
          </div>
          <div>
            <Label>New Quantity</Label>
            <Input 
              type="number" 
              value={formData.new_quantity} 
              onChange={(e) => handleNewQuantityChange(Number(e.target.value))} 
            />
          </div>
          <div>
            <Label>Variance</Label>
            <Input 
              type="number" 
              value={formData.variance} 
              disabled 
              className={formData.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}
            />
          </div>
          <div>
            <Label>Value Variance</Label>
            <Input 
              type="number" 
              value={formData.value_variance.toFixed(2)} 
              disabled 
              className={formData.value_variance >= 0 ? 'text-emerald-600' : 'text-red-600'}
            />
          </div>
          <div className="col-span-2">
            <Label>Reason</Label>
            <Textarea 
              value={formData.reason} 
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Describe the reason for this adjustment..."
            />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
