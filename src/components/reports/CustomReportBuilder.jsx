import React, { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Play, Settings2, QrCode, Search, X, Package, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import DataTable from '../common/DataTable';
import { toast } from 'sonner';
import QRCode from 'qrcode';

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

export default function CustomReportBuilder({ products, transactions, categories, warehouses }) {
  const [source, setSource] = useState('products');
  const [selectedFields, setSelectedFields] = useState(['sku', 'name', 'quantity_in_stock', 'unit_price', 'status']);
  const [groupBy, setGroupBy] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportData, setReportData] = useState(null);
  
  // Product selection
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductSelector, setShowProductSelector] = useState(false);
  
  // QR Code
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [reportId, setReportId] = useState('');
  const [reportAccessUrl, setReportAccessUrl] = useState('');

  const availableFields = REPORT_SOURCES[source]?.fields || [];

  // Filter products for selector
  const filteredProductsForSelection = useMemo(() => {
    if (!productSearchTerm) return products.slice(0, 50);
    const term = productSearchTerm.toLowerCase();
    return products.filter(p => 
      (p.name?.toLowerCase().includes(term)) || 
      (p.sku?.toLowerCase().includes(term))
    ).slice(0, 50);
  }, [products, productSearchTerm]);

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const selectAllProducts = () => {
    setSelectedProducts(filteredProductsForSelection.map(p => p.id));
  };

  const clearProductSelection = () => {
    setSelectedProducts([]);
  };

  const buildReport = async () => {
    let rows = [];

    if (source === 'products') {
      rows = products.map(p => p.data || p).filter(p => {
        // Apply status filter
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        // Apply product selection filter if products are selected
        if (selectedProducts.length > 0 && !selectedProducts.includes(p.id)) return false;
        return true;
      });
    } else {
      rows = transactions.map(t => t.data || t).filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
      });
    }

    const projected = rows.map(row => {
      const result = { id: row.id };
      selectedFields.forEach(f => { result[f] = row[f] ?? '-'; });
      return result;
    });

    setReportData(projected);
    
    // Generate unique report ID for QR code access
    const newReportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setReportId(newReportId);
    
    toast.success(`Report generated: ${projected.length} rows`);
  };

  // Generate QR Code for report access
  const generateQRCode = async () => {
    if (!reportData || reportData.length === 0) {
      toast.error('Please generate a report first');
      return;
    }

    try {
      // Create a secure access URL (in production, this would be a server-generated URL with auth token)
      const accessToken = btoa(JSON.stringify({
        reportId,
        created: new Date().toISOString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days expiry
        fields: selectedFields,
        source,
        rowCount: reportData.length,
      }));
      
      // Generate the access URL
      const baseUrl = window.location.origin;
      const accessUrl = `${baseUrl}/reports/view?token=${accessToken}`;
      setReportAccessUrl(accessUrl);
      
      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(accessUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      
      setQrCodeUrl(qrDataUrl);
      setShowQrModal(true);
      
      toast.success('QR code generated successfully');
    } catch (error) {
      console.error('QR generation error:', error);
      toast.error('Failed to generate QR code');
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `report-qr-${reportId}.png`;
    a.click();
  };

  const copyAccessUrl = () => {
    navigator.clipboard.writeText(reportAccessUrl);
    toast.success('URL copied to clipboard');
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
    a.download = `custom-report-${Date.now()}.csv`;
    a.click();
    toast.success('Report exported');
  };

  const columns = selectedFields.map(f => {
    const fieldDef = availableFields.find(fd => fd.key === f);
    return { header: fieldDef?.label || f, accessor: f };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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
              <Select value={source} onValueChange={(v) => { setSource(v); setSelectedFields([]); setReportData(null); setSelectedProducts([]); }}>
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

          {/* Product Selection (only for products source) */}
          {source === 'products' && (
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Package className="w-4 h-4" /> Select Specific Products
                </Label>
                <Button variant="outline" size="sm" onClick={() => setShowProductSelector(!showProductSelector)}>
                  {showProductSelector ? 'Hide' : 'Show'} Product Selector
                </Button>
              </div>
              
              {selectedProducts.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{selectedProducts.length} products selected</Badge>
                  <Button variant="ghost" size="sm" onClick={clearProductSelection}>
                    <X className="w-3 h-3 mr-1" /> Clear Selection
                  </Button>
                </div>
              )}
              
              {showProductSelector && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Search products by name or SKU..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAllProducts}>Select All Visible</Button>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {filteredProductsForSelection.map(product => (
                      <label 
                        key={product.id} 
                        className="flex items-center gap-3 p-2 hover:bg-slate-100 cursor-pointer border-b last:border-b-0"
                      >
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                        </div>
                        {selectedProducts.includes(product.id) && (
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        )}
                      </label>
                    ))}
                    {filteredProductsForSelection.length === 0 && (
                      <p className="p-4 text-center text-slate-500 text-sm">No products found</p>
                    )}
                  </div>
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

          <div className="flex gap-3 flex-wrap">
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
                <CardTitle className="text-lg">Chart - Grouped by {availableFields.find(f => f.key === groupBy)?.label}</CardTitle>
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
                <span>Results - {reportData.length} rows</span>
                {reportId && <Badge variant="outline">Report ID: {reportId}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={reportData}
                columns={columns}
                searchPlaceholder="Search results..."
                pageSize={20}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" /> Report QR Code
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="Report QR Code" className="w-64 h-64" />
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Access URL</Label>
              <div className="flex gap-2">
                <Input value={reportAccessUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyAccessUrl}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
              <p className="font-medium">Security Notice:</p>
              <ul className="list-disc list-inside mt-1 text-xs">
                <li>This QR code expires in 7 days</li>
                <li>Share only with authorized personnel</li>
                <li>Access is logged for security purposes</li>
              </ul>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowQrModal(false)}>
                Close
              </Button>
              <Button onClick={downloadQRCode}>
                <Download className="w-4 h-4 mr-2" /> Download QR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
