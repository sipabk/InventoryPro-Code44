import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const typeColors = {
  inward: 'bg-emerald-100 text-emerald-700',
  outward: 'bg-red-100 text-red-700',
  transfer: 'bg-blue-100 text-blue-700',
  adjustment: 'bg-amber-100 text-amber-700',
  return: 'bg-purple-100 text-purple-700',
};

const initialTransaction = {
  transaction_number: '', product_id: '', warehouse_id: '', type: 'inward',
  quantity: 0, unit_cost: 0, total_cost: 0, currency: 'USD',
  reference_number: '', supplier_id: '', transaction_date: '', notes: '', status: 'pending',
  serial_numbers: []
};

export default function Transactions() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialTransaction);
  
  const queryClient = useQueryClient();
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
      
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Transaction created successfully');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      return base44.entities.StockTransaction.update(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction status updated');
    },
  });

  const handleSubmit = () => {
    const totalCost = formData.quantity * formData.unit_cost;
    createMutation.mutate({ ...formData, total_cost: totalCost });
  };

  const openCreate = () => {
    setFormData({
      ...initialTransaction,
      transaction_date: new Date().toISOString().split('T')[0]
    });
    setModalOpen(true);
  };

  const columns = [
    { 
      header: 'Transaction', 
      cell: (row) => {
        const Icon = typeIcons[row.type] || ArrowDownCircle;
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${typeColors[row.type] || 'bg-slate-100'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{row.transaction_number}</p>
              <p className="text-xs text-slate-500">{row.reference_number || '-'}</p>
            </div>
          </div>
        );
      }
    },
    { 
      header: 'Type', 
      cell: (row) => (
        <Badge className={typeColors[row.type]}>{row.type}</Badge>
      )
    },
    { 
      header: 'Product', 
      accessor: (row) => products.find(p => p.id === row.product_id)?.name || '-'
    },
    { header: 'Quantity', accessor: 'quantity' },
    { 
      header: 'Total', 
      accessor: (row) => `${row.currency} ${(row.total_cost || 0).toFixed(2)}`
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate({ id: row.id, status: 'completed' })}>
            <Check className="w-4 h-4 text-emerald-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => approveMutation.mutate({ id: row.id, status: 'cancelled' })}>
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
          <h1 className="text-3xl font-bold text-slate-900">Stock Transactions</h1>
          <p className="text-slate-500 mt-1">Track stock movements</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New Transaction
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={transactions} 
          columns={columns} 
          searchPlaceholder="Search transactions..." 
          emptyMessage="No transactions found"
        />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Transaction"
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label>Supplier (for inward)</Label>
            <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Unit Cost</Label>
            <Input type="number" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Transaction Date</Label>
            <Input type="date" value={formData.transaction_date} onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })} />
          </div>
          <div>
            <Label>Reference Number</Label>
            <Input value={formData.reference_number} onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
        </div>
      </FormModal>
    </div>
  );
}
