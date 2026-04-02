import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { logActivity } from '@/hooks/useActivityLog';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDownCircle, ArrowUpCircle, RefreshCw, Settings2, Check, X, Download } from "lucide-react";
import { format } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import { useCurrencies } from '@/components/common/useCurrencies';
import { toast } from "sonner";

const TYPES = ['inward', 'outward', 'transfer', 'adjustment', 'return'];

const typeIcons = {
  inward: ArrowDownCircle,
  outward: ArrowUpCircle,
  transfer: RefreshCw,
  adjustment: Settings2,
  return: ArrowDownCircle,
};

const initialTransaction = {
  transaction_number: '', product_id: '', warehouse_id: '', type: 'inward',
  quantity: 0, unit_cost: 0, total_cost: 0, currency: 'BWP',
  exchange_rate: 1, unit_cost_bwp: 0, total_cost_bwp: 0,
  reference_number: '', supplier_id: '', transaction_date: '', notes: '', status: 'pending',
  serial_numbers: []
};

export default function Transactions() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialTransaction);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currencies = useCurrencies();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.StockTransaction.list('-created_date', 100),
  });

  const { data: products = [] } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const txNumber = `TXN-${Date.now()}`;
      const transaction = await base44.entities.StockTransaction.create({ ...data, transaction_number: txNumber });
      // Update product stock
      const product = products.find(p => p.id === data.product_id);
      if (product) {
        const currentStock = product.quantity_in_stock || 0;
        const newQty = data.type === 'inward' || data.type === 'return'
          ? currentStock + data.quantity
          : currentStock - data.quantity;
        await base44.entities.Product.update(product.id, { quantity_in_stock: Math.max(0, newQty) });
      }
      logActivity('create', 'StockTransaction', transaction.id, txNumber, `${data.type} of ${data.quantity} units`);
      return transaction;
    },
    onSuccess: (transaction, data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Transaction created successfully');
      // If it's a return with serial numbers, redirect to warranties
      if (data.type === 'return' && data.serial_numbers?.length > 0) {
        const sn = data.serial_numbers[0];
        toast.info(`Faulty return detected with serial number(s). Redirecting to Warranty section...`, { duration: 4000 });
        setTimeout(() => navigate(`/Warranties?product_id=${data.product_id}&sn=${encodeURIComponent(sn)}&from_return=1`), 2000);
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      return base44.entities.StockTransaction.update(id, {
        status,
        approved_by: 'current_user',
        approved_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction status updated');
    },
  });

  const handleSubmit = () => {
    const totalCost = formData.quantity * formData.unit_cost;
    const rate = parseFloat(formData.exchange_rate) || 1;
    const unit_cost_bwp = formData.currency === 'BWP' ? formData.unit_cost : formData.unit_cost * rate;
    const total_cost_bwp = formData.quantity * unit_cost_bwp;
    createMutation.mutate({ ...formData, total_cost: totalCost, unit_cost_bwp, total_cost_bwp, exchange_rate: rate });
  };

  const openCreate = () => {
    setFormData({ ...initialTransaction, transaction_date: format(new Date(), 'yyyy-MM-dd') });
    setModalOpen(true);
  };

  const columns = [
    {
      header: 'Transaction',
      cell: (row) => {
        const Icon = typeIcons[row.type] || ArrowDownCircle;
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${row.type === 'inward' ? 'bg-emerald-100' :
                row.type === 'outward' ? 'bg-amber-100' :
                  'bg-blue-100'
              }`}>
              <Icon className={`w-4 h-4 ${row.type === 'inward' ? 'text-emerald-600' :
                  row.type === 'outward' ? 'text-amber-600' :
                    'text-blue-600'
                }`} />
            </div>
            <div>
              <p className="font-medium text-slate-800">{row.transaction_number}</p>
              <p className="text-xs text-slate-500 capitalize">{row.type}</p>
            </div>
          </div>
        );
      }
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
      header: 'Quantity',
      cell: (row) => (
        <span className={`font-semibold ${row.type === 'inward' || row.type === 'return' ? 'text-emerald-600' : 'text-amber-600'}`}>
          {row.type === 'inward' || row.type === 'return' ? '+' : '-'}{row.quantity}
        </span>
      )
    },
    {
      header: 'Total (BWP)',
      accessor: (row) => {
        const bwp = row.total_cost_bwp || row.total_cost || 0;
        return `P ${bwp.toFixed(2)}`;
      }
    },
    {
      header: 'Date',
      accessor: (row) => row.transaction_date ? format(new Date(row.transaction_date), 'MMM d, yyyy') : '-'
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge className={
          row.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            row.status === 'approved' ? 'bg-blue-100 text-blue-700' :
              row.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
        }>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Actions',
      cell: (row) => row.status === 'pending' && (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate({ id: row.id, status: 'approved' })}>
            <Check className="w-4 h-4 text-emerald-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate({ id: row.id, status: 'cancelled' })}>
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
          <h1 className="text-3xl font-bold text-slate-900">Stock Transactions</h1>
          <p className="text-slate-500 mt-1">Track all inventory movements</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Transaction
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable data={transactions} columns={columns} searchPlaceholder="Search transactions..." />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Stock Transaction"
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transaction Type *</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product *</Label>
            <Select value={formData.product_id} onValueChange={(v) => {
              const selectedProduct = products.find(p => p.id === v);
              const requiresSerialTracking = selectedProduct?.serial_number_tracking || selectedProduct?.data?.serial_number_tracking;
              setFormData({ ...formData, product_id: v, serial_numbers: requiresSerialTracking ? formData.serial_numbers : [] });
            }}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => {
                  const isTracked = p.serial_number_tracking || p.data?.serial_number_tracking;
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.data?.name || p.name} ({p.data?.sku || p.sku}){isTracked ? ' 🔢' : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {(() => {
              const selProd = products.find(p => p.id === formData.product_id);
              const tracked = selProd?.serial_number_tracking || selProd?.data?.serial_number_tracking;
              return tracked ? (
                <p className="text-xs text-blue-600 font-medium">🔢 This product requires serial number tracking</p>
              ) : null;
            })()}
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
            <Label>Supplier</Label>
            <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.data?.name || s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity *</Label>
            <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Unit Cost</Label>
            <Input type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Supplier Invoice Currency</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v, exchange_rate: v === 'BWP' ? 1 : formData.exchange_rate })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {formData.currency !== 'BWP' && (
            <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg md:col-span-2">
              <Label className="text-amber-800">Exchange Rate (1 {formData.currency} = ? BWP)</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.exchange_rate}
                onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 1 })}
                placeholder="e.g. 13.5 for 1 USD = 13.5 BWP"
              />
              {formData.unit_cost > 0 && (
                <p className="text-xs text-amber-700 font-medium">
                  BWP equivalent: P {(formData.unit_cost * (parseFloat(formData.exchange_rate) || 1)).toFixed(2)} per unit
                  {formData.quantity > 0 && ` · Total: P ${(formData.quantity * formData.unit_cost * (parseFloat(formData.exchange_rate) || 1)).toFixed(2)}`}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Transaction Date</Label>
            <Input type="date" value={formData.transaction_date} onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Reference Number</Label>
            <Input value={formData.reference_number} onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })} placeholder="PO/Invoice number" />
          </div>
          {(formData.type === 'inward' || formData.type === 'return') && (() => {
            const selProd = products.find(p => p.id === formData.product_id);
            const isTracked = selProd?.serial_number_tracking || selProd?.data?.serial_number_tracking;
            const snCount = (formData.serial_numbers || []).length;
            const qty = formData.quantity || 0;
            if (!isTracked) return null;
            return (
              <div className="space-y-2 md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Label className="flex items-center gap-2 text-blue-800">
                  Serial Numbers <span className="text-xs font-normal text-blue-600">(Required — {snCount}/{qty} entered)</span>
                  {snCount > 0 && snCount !== qty && <span className="text-xs text-amber-600 font-medium">⚠ Count mismatch with quantity</span>}
                  {snCount === qty && qty > 0 && <span className="text-xs text-green-600 font-medium">✓ Complete</span>}
                </Label>
                <Textarea
                  value={(formData.serial_numbers || []).join('\n')}
                  onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                  placeholder={`Enter ${qty} serial numbers, one per line\ne.g. SN-001\nSN-002`}
                  rows={Math.max(4, Math.min(qty, 8))}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500">{snCount} serial numbers entered for {qty} units</p>
              </div>
            );
          })()}
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
        </div>
      </FormModal>
    </div>
  );
}