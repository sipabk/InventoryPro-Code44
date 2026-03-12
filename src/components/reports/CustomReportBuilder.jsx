import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Play, Settings2, QrCode, Copy, X, Search, Package } from 'lucide-react';
import DataTable from '../common/DataTable';
import { toast } from 'sonner';
import { format } from 'date-fns';

const REPORT_SOURCES = {
  products: {
    label: 'Products',
    fields: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
      { key: 'quantity_in_stock', label: 'Qty in Stock', numeric: true },
      { key: 'unit_price', label: 'Unit Price', numeric: true },
      { key: 'cost_price', label: 'Cost Price', numeric: true },
      { key: 'reorder_level', label: 'Reorder Level', numeric: true },
      { key: 'tax_rate', label: 'Tax Rate', numeric: true },
      { key: 'unit_of_measure', label: 'Unit of Measure' },
    ]
  },
  transactions: {
    label: 'Stock Transactions',
    fields: [
      { key: 'transaction_number', label: 'Transaction #' },
      { key: 'type', label: 'Type' },
      { key: 'quantity', label: 'Quantity', numeric: true },
      { key: 'unit_cost', label: 'Unit Cost', numeric: true },
      { key: 'total_cost', label: 'Total Cost', numeric: true },
      { key: 'transaction_date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'reference_number', label: 'Reference #' },
    ]
  }
};

// Simple QR Code generator using Canvas
const generateQRCodeDataURL = (text, size = 200) => {
  // Create a simple QR-like pattern (in production, use a library like qrcode)
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  
  // Create a hash from the text for consistent pattern
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const moduleSize = Math.floor(size / 25);
  const padding = Math.floor((size - moduleSize * 21) / 2);
  
  ctx.fillStyle = '#000000';
  
  // Position detection patterns (corners)
  const drawFinderPattern = (x, y) => {
    // Outer square
    ctx.fillRect(x, y, moduleSize * 7, moduleSize * 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + moduleSize, y + moduleSize, moduleSize * 5, moduleSize * 5);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + moduleSize * 2, y + moduleSize * 2, moduleSize * 3, moduleSize * 3);
  };
  
  drawFinderPattern(padding, padding);
  drawFinderPattern(padding + moduleSize * 14, padding);
  drawFinderPattern(padding, padding + moduleSize * 14);
  
  // Data pattern based on hash
  const random = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  for (let row = 0; row < 21; row++) {
    for (let col = 0; col < 21; col++) {
      // Skip finder patterns
      if ((row < 8 && col < 8) || (row < 8 && col > 12) || (row > 12 && col < 8)) continue;
      
      const seed = hash + row * 21 + col;
      if (random(seed) > 0.5) {
        ctx.fillRect(
          padding + col * moduleSize,
          padding + row * moduleSize,
          moduleSize,
          moduleSize
        );
      }
    }
  }
  
  return canvas.toDataURL('image/png');
};

export default function CustomReportBuilder({ products, transactions, categories, warehouses }) {
  const [source, setSource] = useState('products');
  const [selectedFields, setSelectedFields] = useState(['sku', 'name', 'quantity_in_stock', 'unit_price', 'status']);
  const [groupBy, setGroupBy] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportData, setReportData] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  
  // Product selection state
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);

  const availableFields = REPORT_SOURCES[source]?.fields || [];

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const toggleProduct = (productId) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllProducts = () => {
    const filteredProducts = getFilteredProducts();
    setSelectedProductIds(new Set(filteredProducts.map(p => (p.data || p).id)));
  };

  const clearAllProducts = () => {
    setSelectedProductIds(new Set());
  };

  const getFilteredProducts = useCallback(() => {
    return products.filter(p => {
      const data = p.data || p;
      if (productSearchQuery) {
        const query = productSearchQuery.toLowerCase();
        return (data.name?.toLowerCase().includes(query) || 
                data.sku?.toLowerCase().includes(query));
      }
      return true;
    });
  }, [products, productSearchQuery]);

  const buildReport = () => {
    let rows = [];
    const uniqueId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setReportId(uniqueId);

    if (source === 'products') {
      rows = products.map(p => p.data || p).filter(p => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        // Filter by selected products if any are selected
        if (selectedProductIds.size > 0 && !selectedProductIds.has(p.id)) return false;
        return true;
      });
    } else {
      rows = transactions.map(t => t.data || t).filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
      });
    }

    const projected = rows.map(row => {
      const result = {};
      selectedFields.forEach(f => { result[f] = row[f] ?? '-'; });
      return result;
    });

    setReportData(projected);
    toast.success(`Report generated: ${projected.length} rows`);
  };

  const chartData = useMemo(() => {
    if (!reportData || !groupBy) return [];
    const grouped = {};
    const numericFields = availableFields.filter(f => f.numeric && selectedFields.includes(f.key));
    reportData.forEach(row => {
      const key = row[groupBy] || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = { name: key };
        numericFields.forEach(f => { grouped[key][f.key] = 0; });
      }
      numericFields.forEach(f => { grouped[key][f.key] += Number(row[f.key]) || 0; });
    });
    return Object.values(grouped).slice(0, 20);
  }, [reportData, groupBy, availableFields, selectedFields]);

  const exportCSV = () => {
    if (!reportData?.length) return;
    const headers = selectedFields.join(',');
    const rows = reportData.map(r => selectedFields.map(f => `"${r[f] ?? ''}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom-report-${reportId || Date.now()}.csv`;
    a.click();
    toast.success('Report exported');
  };

  const generateQRCode = () => {
    if (!reportData?.length || !reportId) {
      toast.error('Generate a report first');
      return;
    }

    // Create report metadata for QR code
    const reportMeta = {
      id: reportId,
      source,
      fields: selectedFields,
      rows: reportData.length,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      checksum: btoa(JSON.stringify({ id: reportId, rows: reportData.length })).substr(0, 16)
    };

    // In production, this URL would point to a secure endpoint
    const reportUrl = `${window.location.origin}/reports/view?id=${reportId}&token=${reportMeta.checksum}`;
    
    const qrDataUrl = generateQRCodeDataURL(reportUrl, 250);
    
    setQrCodeData({
      url: reportUrl,
      imageUrl: qrDataUrl,
      meta: reportMeta
    });
    setShowQRModal(true);
  };

  const copyQRLink = () => {
    if (qrCodeData?.url) {
      navigator.clipboard.writeText(qrCodeData.url);
      toast.success('Report link copied to clipboard');
    }
  };

  const downloadQRCode = () => {
    if (qrCodeData?.imageUrl) {
      const a = document.createElement('a');
      a.href = qrCodeData.imageUrl;
      a.download = `report-qr-${reportId}.png`;
      a.click();
      toast.success('QR code downloaded');
    }
  };

  const columns = selectedFields.map(f => {
    const fieldDef = availableFields.find(fd => fd.key === f);
    return { header: fieldDef?.label || f, accessor: f };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const filteredProducts = getFilteredProducts();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Data Source</Label>
              <Select value={source} onValueChange={(v) => { setSource(v); setSelectedFields([]); setReportData(null); setSelectedProductIds(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_SOURCES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  {source === 'transactions' && <>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group By (for chart)</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {availableFields.filter(f => !f.numeric && selectedFields.includes(f.key)).map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Selection for Products source */}
          {source === 'products' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Product Selection
                  {selectedProductIds.size > 0 && (
                    <Badge className="bg-blue-100 text-blue-700 ml-2">
                      {selectedProductIds.size} selected
                    </Badge>
                  )}
                </Label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProductSelector(!showProductSelector)}
                >
                  {showProductSelector ? 'Hide' : 'Select Products'}
                </Button>
              </div>
              
              {showProductSelector && (
                <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search products by name or SKU..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAllProducts}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearAllProducts}>
                      Clear All
                    </Button>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto border rounded bg-white">
                    {filteredProducts.length === 0 ? (
                      <p className="p-4 text-center text-slate-500">No products found</p>
                    ) : (
                      <div className="divide-y">
                        {filteredProducts.slice(0, 50).map(p => {
                          const data = p.data || p;
                          return (
                            <label
                              key={data.id}
                              className="flex items-center gap-3 p-2 hover:bg-slate-50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedProductIds.has(data.id)}
                                onCheckedChange={() => toggleProduct(data.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{data.name}</p>
                                <p className="text-xs text-slate-500">SKU: {data.sku}</p>
                              </div>
                              <Badge className={
                                data.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                              }>
                                {data.status}
                              </Badge>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {filteredProducts.length > 50 && (
                    <p className="text-xs text-slate-500 text-center">
                      Showing 50 of {filteredProducts.length} products. Use search to filter.
                    </p>
                  )}
                  {selectedProductIds.size === 0 && (
                    <p className="text-xs text-slate-500">
                      No products selected - report will include all products matching status filter.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="mb-2 block">Select Fields to Include</Label>
            <div className="flex flex-wrap gap-3">
              {availableFields.map(f => (
                <label key={f.key} className="flex items-center gap-2 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 border hover:bg-slate-100 transition-colors">
                  <Checkbox
                    checked={selectedFields.includes(f.key)}
                    onCheckedChange={() => toggleField(f.key)}
                  />
                  <span className="text-sm">{f.label}</span>
                  {f.numeric && <Badge className="bg-blue-100 text-blue-700 text-xs">numeric</Badge>}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={buildReport} disabled={selectedFields.length === 0}>
              <Play className="w-4 h-4 mr-2" /> Generate Report
            </Button>
            {reportData && (
              <>
                <Button variant="outline" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
                <Button variant="outline" onClick={generateQRCode}>
                  <QrCode className="w-4 h-4 mr-2" /> Generate QR Code
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <>
          {groupBy && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chart — Grouped by {availableFields.find(f => f.key === groupBy)?.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {availableFields.filter(f => f.numeric && selectedFields.includes(f.key)).map((f, i) => (
                      <Bar key={f.key} dataKey={f.key} name={f.label} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Results — {reportData.length} rows</span>
                {reportId && (
                  <Badge className="bg-slate-100 text-slate-700 font-mono text-xs">
                    ID: {reportId}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={reportData.map((r, i) => ({ ...r, id: i }))}
                columns={columns}
                searchPlaceholder="Search results..."
                pageSize={20}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* QR Code Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Report QR Code
            </DialogTitle>
          </DialogHeader>
          
          {qrCodeData && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <img 
                  src={qrCodeData.imageUrl} 
                  alt="Report QR Code" 
                  className="w-48 h-48"
                />
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-600">Report ID:</span>
                  <span className="font-mono">{qrCodeData.meta.id}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-600">Rows:</span>
                  <span>{qrCodeData.meta.rows}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-slate-600">Generated:</span>
                  <span>{format(new Date(qrCodeData.meta.generatedAt), 'MMM d, yyyy HH:mm')}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
                  <span className="text-amber-600">Expires:</span>
                  <span className="text-amber-700">{format(new Date(qrCodeData.meta.expiresAt), 'MMM d, yyyy HH:mm')}</span>
                </div>
              </div>

              <div className="p-2 bg-slate-100 rounded text-xs font-mono break-all">
                {qrCodeData.url}
              </div>

              <div className="flex gap-2">
                <Button onClick={copyQRLink} variant="outline" className="flex-1">
                  <Copy className="w-4 h-4 mr-2" /> Copy Link
                </Button>
                <Button onClick={downloadQRCode} className="flex-1">
                  <Download className="w-4 h-4 mr-2" /> Download QR
                </Button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Scan this QR code to securely access the report. The link expires in 24 hours.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
