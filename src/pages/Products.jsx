import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Package, Download, Upload, Filter, X, Hash, Loader2, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import BulkEditBar from '@/components/common/BulkEditBar';
import { useCurrencies } from '@/components/common/useCurrencies';
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);
  
  const queryClient = useQueryClient();
  const currencies = useCurrencies();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Product created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Product updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteOpen(false);
      toast.success('Product deleted successfully');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, data }) => {
      for (const id of ids) {
        await base44.entities.Product.update(id, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds(new Set());
      toast.success('Products updated successfully');
    },
  });

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

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const filteredProducts = products.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (categoryFilter && p.category_id !== categoryFilter) return false;
    return true;
  });

  // Export products to CSV
  const handleExport = () => {
    if (products.length === 0) {
      toast.error('No products to export');
      return;
    }
    
    const exportFields = ['sku', 'name', 'description', 'category_id', 'supplier_id', 'warehouse_id', 
      'unit_price', 'cost_price', 'currency', 'quantity_in_stock', 'reorder_level', 'reorder_quantity',
      'unit_of_measure', 'barcode', 'status', 'tax_rate'];
    
    const headers = exportFields.join(',');
    const rows = products.map(p => 
      exportFields.map(field => {
        const val = p[field] ?? '';
        return String(val).includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    // Log activity
    base44.entities.ActivityLog?.create({
      action: 'export',
      entity_type: 'Product',
      entity_name: 'Products Export',
      details: `Exported ${products.length} products to CSV`,
      user_name: 'System',
      created_date: new Date().toISOString()
    }).catch(() => {});
    
    toast.success(`Exported ${products.length} products`);
  };

  // Download import template
  const downloadTemplate = () => {
    const template = 'sku,name,description,category_id,supplier_id,warehouse_id,unit_price,cost_price,currency,quantity_in_stock,reorder_level,reorder_quantity,unit_of_measure,barcode,status,tax_rate\nSKU001,Sample Product,Product description,,,,10.00,8.00,BWP,100,10,50,piece,,active,0';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle file selection for import
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadFile(file);
    setImportResults(null);
    setPreviewData([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const preview = lines.slice(1, 6).map(line => {
          const values = parseCSVLine(line);
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i]?.trim() || '';
          });
          return row;
        });
        setPreviewData(preview);
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV line handling quoted values
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  // Import products from CSV
  const handleImport = async () => {
    if (!uploadFile) return;
    
    setImporting(true);
    setImportProgress(0);
    
    try {
      const text = await uploadFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      const totalRows = lines.length - 1;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line);
        const data = {};
        
        headers.forEach((header, idx) => {
          const value = values[idx]?.trim() || '';
          // Convert numeric fields
          if (['unit_price', 'cost_price', 'quantity_in_stock', 'reorder_level', 'reorder_quantity', 'tax_rate'].includes(header)) {
            data[header] = parseFloat(value) || 0;
          } else {
            data[header] = value;
          }
        });
        
        // Validate required fields
        if (!data.sku || !data.name) {
          errors.push(`Row ${i}: Missing SKU or name`);
          errorCount++;
          continue;
        }
        
        // Set defaults
        data.status = data.status || 'active';
        data.currency = data.currency || 'BWP';
        data.unit_of_measure = data.unit_of_measure || 'piece';
        
        try {
          await base44.entities.Product.create(data);
          successCount++;
        } catch (error) {
          errors.push(`Row ${i}: ${error.message || 'Failed to create'}`);
          errorCount++;
        }
        
        setImportProgress(Math.round((i / totalRows) * 100));
      }
      
      setImportResults({ success: successCount, errors: errorCount, errorDetails: errors });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      // Log activity
      base44.entities.ActivityLog?.create({
        action: 'import',
        entity_type: 'Product',
        entity_name: 'Products Import',
        details: `Imported ${successCount} products, ${errorCount} errors`,
        user_name: 'System',
        created_date: new Date().toISOString()
      }).catch(() => {});
      
      if (successCount > 0) {
        toast.success(`Imported ${successCount} products successfully`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} rows had errors`);
      }
    } catch (error) {
      toast.error('Import failed: ' + error.message);
    }
    
    setImporting(false);
  };

  const resetImport = () => {
    setUploadFile(null);
    setPreviewData([]);
    setImportResults(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const columns = [
    { 
      header: '', 
      cell: (row) => (
        <Checkbox 
          checked={selectedIds.has(row.id)}
          onCheckedChange={() => toggleSelect(row.id)}
        />
      )
    },
    { 
      header: 'Product', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-500">SKU: {row.sku}</p>
          </div>
        </div>
      )
    },
    { header: 'Category', accessor: (row) => categories.find(c => c.id === row.category_id)?.name || '-' },
    { header: 'Stock', accessor: 'quantity_in_stock' },
    { header: 'Unit Price', accessor: (row) => `${row.currency} ${(row.unit_price || 0).toFixed(2)}` },
    { header: 'Cost Price', accessor: (row) => `${row.currency} ${(row.cost_price || 0).toFixed(2)}` },
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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(row); setDeleteOpen(true); }}>
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
          <h1 className="text-3xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500 mt-1">Manage your inventory products</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter || categoryFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(''); setCategoryFilter(''); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <BulkEditBar
          selectedCount={selectedIds.size}
          fields={BULK_FIELDS}
          onApply={(data) => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), data })}
          onClear={() => setSelectedIds(new Set())}
          isLoading={bulkUpdateMutation.isPending}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={filteredProducts} 
          columns={columns} 
          searchPlaceholder="Search products..." 
          emptyMessage="No products found"
        />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>SKU</Label>
            <Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Name</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="col-span-3">
            <Label>Description</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Supplier</Label>
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
            <Label>Unit Price</Label>
            <Input type="number" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Cost Price</Label>
            <Input type="number" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })} />
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
            <Label>Quantity in Stock</Label>
            <Input type="number" value={formData.quantity_in_stock} onChange={(e) => setFormData({ ...formData, quantity_in_stock: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Reorder Level</Label>
            <Input type="number" value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Reorder Quantity</Label>
            <Input type="number" value={formData.reorder_quantity} onChange={(e) => setFormData({ ...formData, reorder_quantity: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Barcode</Label>
            <Input value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
          </div>
          <div>
            <Label>Tax Rate (%)</Label>
            <Input type="number" value={formData.tax_rate} onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(editingProduct?.id)}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />

      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={(open) => { setImportModalOpen(open); if (!open) resetImport(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <FileText className="w-4 h-4 mr-2" /> Download Template
              </Button>
            </div>
            
            <div>
              <Label>Upload CSV File</Label>
              <Input 
                ref={fileInputRef}
                type="file" 
                accept=".csv"
                onChange={handleFileSelect}
                className="mt-2"
              />
            </div>
            
            {previewData.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <p className="p-2 bg-slate-50 text-sm font-medium">Preview (first 5 rows)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        {Object.keys(previewData[0]).slice(0, 6).map(key => (
                          <th key={key} className="px-2 py-1 text-left">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(row).slice(0, 6).map((val, j) => (
                            <td key={j} className="px-2 py-1">{String(val).substring(0, 20)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {importing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing... {importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}
            
            {importResults && (
              <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                    <span>{importResults.success} imported</span>
                  </div>
                  {importResults.errors > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-5 h-5" />
                      <span>{importResults.errors} errors</span>
                    </div>
                  )}
                </div>
                {importResults.errorDetails?.length > 0 && (
                  <div className="mt-2 text-xs text-red-600 max-h-32 overflow-y-auto">
                    {importResults.errorDetails.slice(0, 10).map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                    {importResults.errorDetails.length > 10 && (
                      <p>...and {importResults.errorDetails.length - 10} more errors</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setImportModalOpen(false); resetImport(); }}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!uploadFile || importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Import Products
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
