import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Package, Download, Upload, Filter, X, Hash } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import BulkEditBar from '@/components/common/BulkEditBar';
import { useCurrencies } from '@/components/common/useCurrencies';
import { logActivity } from '@/hooks/useActivityLog';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
const STATUSES = ['active', 'inactive', 'discontinued'];

const initialProduct = {
  sku: '', name: '', description: '', category_id: '', supplier_id: '', preferred_supplier_id: '', warehouse_id: '',
  unit_price: 0, cost_price: 0, currency: 'USD', quantity_in_stock: 0, reorder_level: 10,
  reorder_quantity: 50, unit_of_measure: 'piece', serial_number_tracking: false,
  length: 0, width: 0, height: 0, weight: 0,
  dimension_unit: 'cm', weight_unit: 'kg', purchase_date: '', barcode: '', status: 'active', tax_rate: 0
};

const BULK_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'discontinued', label: 'Discontinued' }] },
  { key: 'unit_price', label: 'Unit Price', type: 'number' },
  { key: 'cost_price', label: 'Cost Price', type: 'number' },
  { key: 'reorder_level', label: 'Reorder Level', type: 'number' },
  { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
];

export default function Products() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialProduct);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  const queryClient = useQueryClient();
  const currencies = useCurrencies();
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: (product, data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      logActivity('create', 'Product', product.id, data.name, `SKU: ${data.sku}`);
      setModalOpen(false);
      toast.success('Product created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: (_, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      logActivity('update', 'Product', id, data.name, `Updated product`);
      setModalOpen(false);
      toast.success('Product updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      logActivity('delete', 'Product', id, editingProduct?.name, 'Product deleted');
      setDeleteOpen(false);
      toast.success('Product deleted successfully');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, field, value }) => {
      const parsed = ['unit_price', 'cost_price', 'reorder_level', 'tax_rate'].includes(field) ? parseFloat(value) : value;
      for (const id of ids) {
        await base44.entities.Product.update(id, { [field]: parsed });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(new Set());
      toast.success('Bulk update applied');
    },
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (filtered) => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const handleSubmit = () => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setFormData(initialProduct);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setFormData(product);
    setModalOpen(true);
  };

  const openDelete = (product) => {
    setEditingProduct(product);
    setDeleteOpen(true);
  };

  const filteredProducts = products.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    return true;
  });

  const columns = [
    {
      header: (
        <Checkbox
          checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
          onCheckedChange={() => toggleAll(filteredProducts)}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedIds.has(row.id)}
          onCheckedChange={() => toggleSelect(row.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      className: 'w-10'
    },
    { 
      header: 'Product', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-500">{row.sku}</p>
          </div>
        </div>
      )
    },
    { 
      header: 'Category', 
      accessor: (row) => { const c = categories.find(cat => cat.id === row.category_id); return c?.data?.name || c?.name || '-'; }
    },
    { 
      header: 'Stock', 
      cell: (row) => (
        <span className={`font-semibold ${row.quantity_in_stock <= row.reorder_level ? 'text-red-600' : 'text-slate-800'}`}>
          {row.quantity_in_stock || 0}
        </span>
      )
    },
    { 
      header: 'Price', 
      accessor: (row) => `${row.currency || 'USD'} ${(row.unit_price || 0).toFixed(2)}`
    },
    { 
      header: 'Cost', 
      accessor: (row) => `${row.currency || 'USD'} ${(row.cost_price || 0).toFixed(2)}`
    },
    {
      header: 'S/N Track',
      cell: (row) => row.serial_number_tracking ? (
        <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1 w-fit">
          <Hash className="w-3 h-3" /> Tracked
        </Badge>
      ) : <span className="text-slate-400 text-xs">No</span>
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <Badge className={
          row.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
          row.status === 'inactive' ? 'bg-slate-100 text-slate-700' :
          'bg-red-100 text-red-700'
        }>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDelete(row); }}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 mt-1">Manage your inventory products</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/ImportExport')}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={() => {
            const headers = ['sku','name','description','category_id','supplier_id','unit_price','cost_price','currency','quantity_in_stock','reorder_level','reorder_quantity','unit_of_measure','status','tax_rate'];
            let csv = headers.join(',') + '\n';
            filteredProducts.forEach(p => { csv += headers.map(h => { const v = p[h]; return typeof v === 'string' && v.includes(',') ? `"${v}"` : (v ?? ''); }).join(',') + '\n'; });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            toast.success('Products exported');
          }}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <BulkEditBar
          selectedCount={selectedIds.size}
          fields={BULK_FIELDS}
          onApply={(field, value) => bulkUpdateMutation.mutate({ ids: [...selectedIds], field, value })}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {(statusFilter || categoryFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setCategoryFilter(''); }}>
              <X className="w-4 h-4 mr-1" /> Clear filters
            </Button>
          )}
        </div>
        <DataTable
          data={filteredProducts}
          columns={columns}
          searchPlaceholder="Search by name, SKU, barcode..."
          emptyMessage="No products found. Add your first product to get started."
        />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>SKU *</Label>
            <Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.data?.name || c.name}</SelectItem>)}
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
            <Label>Preferred Supplier</Label>
            <Select value={formData.preferred_supplier_id} onValueChange={(v) => setFormData({ ...formData, preferred_supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select preferred supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.data?.name || s.name}</SelectItem>)}
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
            <Label>Currency (or type custom)</Label>
            <Input 
              value={formData.currency} 
              onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
              list="currency-options"
              placeholder="USD, EUR, GBP, etc."
            />
            <datalist id="currency-options">
              {currencies.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Unit Price</Label>
            <Input type="number" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Cost Price</Label>
            <Input type="number" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Quantity in Stock</Label>
            <Input type="number" value={formData.quantity_in_stock} onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Reorder Level</Label>
            <Input type="number" value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Reorder Quantity</Label>
            <Input type="number" value={formData.reorder_quantity} onChange={(e) => setFormData({ ...formData, reorder_quantity: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Unit of Measure</Label>
            <Select value={formData.unit_of_measure} onValueChange={(v) => setFormData({ ...formData, unit_of_measure: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">Piece</SelectItem>
                <SelectItem value="kg">Kilogram</SelectItem>
                <SelectItem value="lb">Pound</SelectItem>
                <SelectItem value="box">Box</SelectItem>
                <SelectItem value="carton">Carton</SelectItem>
                <SelectItem value="pallet">Pallet</SelectItem>
                <SelectItem value="liter">Liter</SelectItem>
                <SelectItem value="gallon">Gallon</SelectItem>
                <SelectItem value="meter">Meter</SelectItem>
                <SelectItem value="foot">Foot</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Dimensions (L × W × H)</Label>
            <div className="grid grid-cols-4 gap-2">
              <Input type="number" placeholder="Length" value={formData.length || ''} onChange={(e) => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })} />
              <Input type="number" placeholder="Width" value={formData.width || ''} onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) || 0 })} />
              <Input type="number" placeholder="Height" value={formData.height || ''} onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) || 0 })} />
              <Select value={formData.dimension_unit} onValueChange={(v) => setFormData({ ...formData, dimension_unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="inch">inch</SelectItem>
                  <SelectItem value="meter">meter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Weight</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" value={formData.weight || ''} onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })} />
              <Select value={formData.weight_unit} onValueChange={(v) => setFormData({ ...formData, weight_unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lb">lb</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tax Rate (%)</Label>
            <Input type="number" value={formData.tax_rate} onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="md:col-span-2 flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <Switch
              checked={!!formData.serial_number_tracking}
              onCheckedChange={(v) => setFormData({ ...formData, serial_number_tracking: v })}
              id="sn-tracking"
            />
            <div>
              <label htmlFor="sn-tracking" className="font-medium text-slate-800 cursor-pointer flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-600" />
                Serial Number Tracking
              </label>
              <p className="text-xs text-slate-500">When enabled, stock receipts will prompt for serial numbers for each unit</p>
            </div>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(editingProduct?.id)}
        title="Delete Product"
        description={`Are you sure you want to delete "${editingProduct?.name}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}