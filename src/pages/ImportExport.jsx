import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

const ENTITY_TYPES = [
  { value: 'products', label: 'Products', entity: 'Product' },
  { value: 'categories', label: 'Categories', entity: 'Category' },
  { value: 'warehouses', label: 'Warehouses', entity: 'Warehouse' },
  { value: 'suppliers', label: 'Suppliers', entity: 'Supplier' },
  { value: 'warranties', label: 'Warranties', entity: 'Warranty' },
];

export default function ImportExport() {
  const [selectedEntity, setSelectedEntity] = useState('products');
  const [uploadFile, setUploadFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const getEntityData = (type) => {
    switch(type) {
      case 'products': return products;
      case 'categories': return categories;
      case 'warehouses': return warehouses;
      case 'suppliers': return suppliers;
      case 'warranties': return warranties;
      default: return [];
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadFile(file);
    setImportResults(null);
    setPreviewData([]);
    
    // Read file for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const preview = lines.slice(1, 6).map(line => {
          const values = line.split(',');
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

  const handleImport = async () => {
    if (!uploadFile) return;
    
    setImporting(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          const entityConfig = ENTITY_TYPES.find(t => t.value === selectedEntity);
          let successCount = 0;
          let errorCount = 0;
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(',');
            const data = {};
            headers.forEach((header, idx) => {
              data[header] = values[idx]?.trim() || '';
            });
            
            try {
              await base44.entities[entityConfig.entity].create(data);
              successCount++;
            } catch (error) {
              errorCount++;
            }
          }
          
          setImportResults({ success: successCount, errors: errorCount });
          queryClient.invalidateQueries({ queryKey: [selectedEntity] });
          toast.success(`Imported ${successCount} records successfully`);
        }
      };
      reader.readAsText(uploadFile);
    } catch (error) {
      toast.error('Import failed');
    }
    
    setImporting(false);
  };

  const handleExport = () => {
    const data = getEntityData(selectedEntity);
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]).filter(k => !k.startsWith('_')).join(',');
    const rows = data.map(row => 
      Object.entries(row)
        .filter(([k]) => !k.startsWith('_'))
        .map(([, v]) => String(v).includes(',') ? `"${v}"` : v)
        .join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntity}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    toast.success('Export completed');
  };

  const downloadTemplate = () => {
    const templates = {
      products: 'sku,name,description,category_id,unit_price,cost_price,quantity_in_stock,reorder_level,status',
      categories: 'name,description,color,status',
      warehouses: 'name,code,address,city,country,phone,capacity,status',
      suppliers: 'name,code,contact_person,email,phone,address,city,country,payment_terms,status',
      warranties: 'product_id,serial_number,warranty_provider,start_date,end_date,warranty_type,status',
    };
    
    const blob = new Blob([templates[selectedEntity]], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntity}-template.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Import / Export</h1>
          <p className="text-slate-500 mt-1">Bulk import and export data</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Data Type</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Upload CSV File</Label>
              <Input 
                type="file" 
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-2"
              />
            </div>
            
            <Button variant="outline" onClick={downloadTemplate}>
              <FileText className="w-4 h-4 mr-2" /> Download Template
            </Button>
            
            {previewData.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <p className="p-2 bg-slate-50 text-sm font-medium">Preview (first 5 rows)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewData[0]).map(key => (
                        <TableHead key={key} className="text-xs">{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((val, j) => (
                          <TableCell key={j} className="text-xs">{String(val).substring(0, 20)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {importResults && (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
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
            )}
            
            <Button onClick={handleImport} disabled={!uploadFile || importing} className="w-full">
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Import Data
            </Button>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" /> Export Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Data Type</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                {getEntityData(selectedEntity).length} records available for export
              </p>
            </div>
            
            <Button onClick={handleExport} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Export to CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
