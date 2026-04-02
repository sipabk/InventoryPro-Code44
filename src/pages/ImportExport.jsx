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
    switch (type) {
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

    // Upload file and extract data
    setImporting(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const entityConfig = ENTITY_TYPES.find(t => t.value === selectedEntity);
    const schema = await base44.entities[entityConfig.entity].schema();

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: { type: "object", properties: schema.properties }
      }
    });

    if (result.status === 'success' && result.output) {
      setPreviewData(Array.isArray(result.output) ? result.output.slice(0, 10) : [result.output]);
    } else {
      toast.error(result.details || 'Failed to parse file');
    }
    setImporting(false);
  };

  const handleImport = async () => {
    if (!previewData.length) return;

    setImporting(true);
    const entityConfig = ENTITY_TYPES.find(t => t.value === selectedEntity);

    const successRows = [];
    const failedRows = [];

    for (let i = 0; i < previewData.length; i++) {
      const item = previewData[i];
      try {
        await base44.entities[entityConfig.entity].create(item);
        successRows.push({ row: i + 1, data: item });
      } catch (err) {
        failedRows.push({ row: i + 1, data: item, error: err.message || 'Unknown error' });
      }
    }

    setImportResults({ successRows, failedRows });
    queryClient.invalidateQueries({ queryKey: [selectedEntity] });
    setImporting(false);

    if (successRows.length > 0) toast.success(`Imported ${successRows.length} records successfully`);
    if (failedRows.length > 0) toast.error(`${failedRows.length} rows failed to import`);
  };

  const downloadErrorReport = () => {
    if (!importResults?.failedRows?.length) return;
    const headers = ['Row', 'Error', ...Object.keys(importResults.failedRows[0].data)];
    let csv = headers.join(',') + '\n';
    importResults.failedRows.forEach(({ row, data, error }) => {
      const values = [row, `"${error}"`, ...Object.values(data).map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v ?? '')];
      csv += values.join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TEMPLATE_HEADERS = {
    products: ['sku', 'name', 'description', 'unit_price', 'cost_price', 'quantity_in_stock', 'reorder_level', 'reorder_quantity', 'unit_of_measure', 'status'],
    categories: ['name', 'description', 'color', 'status'],
    warehouses: ['name', 'code', 'address', 'city', 'country', 'manager_name', 'manager_email', 'phone', 'capacity', 'status'],
    suppliers: ['name', 'code', 'contact_person', 'email', 'phone', 'address', 'city', 'country', 'payment_terms', 'currency', 'status'],
    warranties: ['serial_number', 'warranty_provider', 'provider_contact', 'provider_email', 'provider_phone', 'start_date', 'end_date', 'duration_months', 'warranty_type', 'coverage_details', 'status'],
  };

  const downloadTemplate = (entityValue, entityLabel) => {
    const headers = TEMPLATE_HEADERS[entityValue] || [];
    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityValue}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${entityLabel} template downloaded`);
  };

  const handleExport = () => {
    const data = getEntityData(selectedEntity);
    const headers = Object.keys(data[0] || {}).filter(k => k !== 'id');

    let csv = headers.join(',') + '\n';
    data.forEach(row => {
      csv += headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val ?? '';
      }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntity}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast.success('Export completed');
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Import / Export</h1>
          <p className="text-slate-500 mt-1">Bulk data management with Excel/CSV</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload File (CSV, XLSX, XLS)</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm text-slate-600">
                    {uploadFile ? uploadFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">CSV, XLSX, or XLS up to 10MB</p>
                </label>
              </div>
            </div>

            {importing && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>Processing file...</span>
              </div>
            )}

            {previewData.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Preview ({previewData.length} rows):</p>
                <div className="border rounded-lg overflow-x-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(previewData[0]).slice(0, 5).map(key => (
                          <TableHead key={key} className="text-xs">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).slice(0, 5).map((val, j) => (
                            <TableCell key={j} className="text-xs truncate max-w-32">{String(val || '-')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={handleImport} disabled={importing} className="w-full">
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Import {previewData.length} Records
                </Button>
              </div>
            )}

            {importResults && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-700">{importResults.successRows.length} records imported successfully</span>
                </div>
                {importResults.failedRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-red-700">{importResults.failedRows.length} rows failed</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                        <Download className="w-3 h-3 mr-1" /> Download Error Report
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg divide-y bg-white">
                      {importResults.failedRows.map(({ row, error }) => (
                        <div key={row} className="flex items-start gap-2 p-2 text-xs">
                          <span className="font-semibold text-slate-500 w-12 shrink-0">Row {row}</span>
                          <span className="text-red-600">{error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Records to export:</span>
                <Badge>{getEntityData(selectedEntity).length}</Badge>
              </div>
            </div>

            <Button onClick={handleExport} className="w-full" disabled={getEntityData(selectedEntity).length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>

            <div className="text-xs text-slate-500 space-y-1">
              <p><FileText className="w-3 h-3 inline mr-1" /> Export includes all fields</p>
              <p><FileText className="w-3 h-3 inline mr-1" /> Compatible with Excel, Google Sheets</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Template Downloads */}
      <Card>
        <CardHeader>
          <CardTitle>Download Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {ENTITY_TYPES.map(entity => (
              <Button key={entity.value} variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => downloadTemplate(entity.value, entity.label)}>
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <span className="text-sm">{entity.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}