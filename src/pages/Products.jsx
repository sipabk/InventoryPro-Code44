import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Plus, Edit2, Trash2, Package, Download, Upload, Filter, X, Hash, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  
  // Import/Export state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [exportFormat, setExportFormat] = useState('csv');
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
    const data = p.data || p;
    if (statusFilter && data.status !== statusFilter) return false;
    if (categoryFilter && data.category_id !== categoryFilter) return false;
    return true;
  });

  // Import functions
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportFile(file);
    setImportResults(null);
    setImportPreview([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const preview = lines.slice(1, 6).map(line => {
          const values = parseCSVLine(line);
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i]?.trim() || '';
          });
          return row;
        });
        setImportPreview(preview);
      }
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/"/g, ''));
    return result;
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setImporting(true);
    setImportProgress(0);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase().replace(/ /g, '_'));
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const data = {};
          
          headers.forEach((header, idx) => {
            const value = values[idx]?.trim() || '';
            // Map common headers
            const mappedHeader = mapHeader(header);
            if (mappedHeader) {
              data[mappedHeader] = parseValue(mappedHeader, value);
            }
          });
          
          // Set defaults
          if (!data.status) data.status = 'active';
          if (!data.currency) data.currency = 'BWP';
          
          try {
            await base44.entities.Product.create(data);
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push({ row: i + 1, error: error.message || 'Failed to create' });
          }
          
          setImportProgress(Math.round((i / (lines.length - 1)) * 100));
        }
        
        setImportResults({ success: successCount, errors: errorCount, errorList: errors });
        queryClient.invalidateQueries({ queryKey: ['products'] });
        
        // Log activity
        try {
          await base44.entities.ActivityLog.create({
            action: 'import',
            entity_type: 'Product',
            entity_name: importFile.name,
            details: `Imported ${successCount} products, ${errorCount} errors`,
            user_name: 'User',
            created_date: new Date().toISOString()
          });
        } catch (e) {
          console.log('[v0] Activity log skipped');
        }
        
        if (successCount > 0) {
          toast.success(`Successfully imported ${successCount} products`);
        }
        if (errorCount > 0) {
          toast.error(`Failed to import ${errorCount} products`);
        }
      }
      setImporting(false);
    };
    reader.readAsText(importFile);
  };

  const mapHeader = (header) => {
    const headerMap = {
      'sku': 'sku',
      'product_sku': 'sku',
      'name': 'name',
      'product_name': 'name',
      'description': 'description',
      'category': 'category_id',
      'category_id': 'category_id',
      'supplier': 'supplier_id',
      'supplier_id': 'supplier_id',
      'warehouse': 'warehouse_id',
      'warehouse_id': 'warehouse_id',
      'unit_price': 'unit_price',
      'price': 'unit_price',
      'cost_price': 'cost_price',
      'cost': 'cost_price',
      'quantity': 'quantity_in_stock',
      'quantity_in_stock': 'quantity_in_stock',
      'stock': 'quantity_in_stock',
      'reorder_level': 'reorder_level',
      'reorder_quantity': 'reorder_quantity',
      'status': 'status',
      'barcode': 'barcode',
      'tax_rate': 'tax_rate',
      'currency': 'currency',
    };
    return headerMap[header] || null;
  };

  const parseValue = (field, value) => {
    const numericFields = ['unit_price', 'cost_price', 'quantity_in_stock', 'reorder_level', 'reorder_quantity', 'tax_rate'];
    if (numericFields.includes(field)) {
      return parseFloat(value) || 0;
    }
    return value;
  };

  const downloadTemplate = () => {
    const template = 'sku,name,description,unit_price,cost_price,quantity_in_stock,reorder_level,status,barcode,tax_rate\n"SKU001","Product Name","Description",100.00,80.00,50,10,active,"123456789",15';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products-import-template.csv';
    a.click();
    toast.success('Template downloaded');
  };

  // Export functions
  const handleExport = async () => {
    const dataToExport = selectedIds.size > 0 
      ? products.filter(p => selectedIds.has((p.data || p).id))
      : products;
    
    if (dataToExport.length === 0) {
      toast.error('No products to export');
      return;
    }

    const headers = ['sku', 'name', 'description', 'category_id', 'supplier_id', 'warehouse_id', 'unit_price', 'cost_price', 'currency', 'quantity_in_stock', 'reorder_level', 'reorder_quantity', 'status', 'barcode', 'tax_rate'];
    
    let content = '';
    if (exportFormat === 'csv') {
      content = [
        headers.join(','),
        ...dataToExport.map(p => {
          const data = p.data || p;
          return headers.map(h => {
            const val = data[h] ?? '';
            return typeof val === 'string' && (val.includes(',') || val.includes('"')) 
              ? `"${val.replace(/"/g, '""')}"` 
              : val;
          }).join(',');
        })
      ].join('\n');
    } else {
      // JSON format
      content = JSON.stringify(dataToExport.map(p => {
        const data = p.data || p;
        const result = {};
        headers.forEach(h => { result[h] = data[h]; });
        return result;
      }), null, 2);
    }

    const blob = new Blob([content], { type: exportFormat === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
    a.click();

    // Log activity
    try {
      await base44.entities.ActivityLog.create({
        action: 'export',
        entity_type: 'Product',
        entity_name: `${dataToExport.length} products`,
        details: `Exported ${dataToExport.length} products as ${exportFormat.toUpperCase()}`,
        user_name: 'User',
        created_date: new Date().toISOString()
      });
    } catch (e) {
      console.log('[v0] Activity log skipped');
    }

    setExportModalOpen(false);
    toast.success(`Exported ${dataToExport.length} products`);
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <Button variant="outline" onClick={() => setExportModalOpen(true)}>
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
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Import Products
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="flex-1"
              />
              <Button variant="outline" onClick={downloadTemplate}>
                <FileText className="w-4 h-4 mr-2" /> Template
              </Button>
            </div>

            {importPreview.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <p className="p-2 bg-slate-50 text-sm font-medium">Preview (first 5 rows)</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(importPreview[0]).map(key => (
                          <TableHead key={key} className="text-xs whitespace-nowrap">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).map((val, j) => (
                            <TableCell key={j} className="text-xs">{String(val).substring(0, 30)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importing products...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            )}

            {importResults && (
              <div className="p-4 rounded-lg bg-slate-50 space-y-2">
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
                {importResults.errorList?.length > 0 && (
                  <div className="text-xs text-red-600 max-h-20 overflow-y-auto">
                    {importResults.errorList.slice(0, 5).map((err, i) => (
                      <p key={i}>Row {err.row}: {err.error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setImportModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!importFile || importing}
                className="flex-1"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" /> Export Products
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                {selectedIds.size > 0 
                  ? `${selectedIds.size} products selected for export`
                  : `${products.length} products will be exported`
                }
              </p>
            </div>

            <div>
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Comma Separated)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setExportModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleExport} className="flex-1">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
