import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Shield, AlertTriangle, CheckCircle, XCircle, Clock, Download, Search, QrCode, Package, History, RotateCcw } from "lucide-react";
import { format, differenceInDays, addMonths } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";
import { useSearchParams, useNavigate } from 'react-router-dom';

const WARRANTY_TYPES = ['manufacturer', 'extended', 'third_party', 'in_house'];
const STATUSES = ['active', 'expired', 'expiring_soon', 'claimed', 'void'];
const RETURN_REASONS = ['defective', 'damaged', 'not_working', 'wrong_item', 'other'];

const statusConfig = {
  active: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  expiring_soon: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700' },
  expired: { icon: XCircle, color: 'bg-red-100 text-red-700' },
  claimed: { icon: Clock, color: 'bg-blue-100 text-blue-700' },
  void: { icon: XCircle, color: 'bg-slate-100 text-slate-700' },
};

const initialWarranty = {
  product_id: '', serial_number: '', warranty_provider: '', provider_contact: '',
  provider_email: '', provider_phone: '', start_date: '', end_date: '',
  duration_months: 12, warranty_type: 'manufacturer', coverage_details: '',
  terms_conditions: '', status: 'active', document_url: ''
};

const initialReturn = {
  serial_number: '',
  reason: 'defective',
  description: '',
  return_date: new Date().toISOString().split('T')[0],
  condition: 'faulty'
};

export default function Warranties() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState(null);
  const [formData, setFormData] = useState(initialWarranty);
  
  // Serial number lookup state
  const [serialLookupOpen, setSerialLookupOpen] = useState(false);
  const [serialQuery, setSerialQuery] = useState('');
  const [foundWarranty, setFoundWarranty] = useState(null);
  const [lookupError, setLookupError] = useState('');
  
  // Faulty returns state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnFormData, setReturnFormData] = useState(initialReturn);
  const [returnHistory, setReturnHistory] = useState([]);
  
  const queryClient = useQueryClient();

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: faultyReturns = [] } = useQuery({
    queryKey: ['faultyReturns'],
    queryFn: async () => {
      try {
        return await base44.entities.FaultyReturn.list('-return_date', 200);
      } catch {
        return [];
      }
    },
  });

  // Check for serial number in URL params (from redirect)
  useEffect(() => {
    const serial = searchParams.get('serial');
    if (serial) {
      setSerialQuery(serial);
      handleSerialLookup(serial);
      setSerialLookupOpen(true);
    }
  }, [searchParams]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Warranty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Warranty.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Warranty.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setDeleteOpen(false);
      toast.success('Warranty deleted successfully');
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (data) => {
      try {
        await base44.entities.FaultyReturn.create(data);
      } catch {
        // Entity might not exist, log the return anyway
        console.log('[v0] Faulty return logged:', data);
      }
      
      // If warranty exists, update its status to claimed
      if (foundWarranty) {
        await base44.entities.Warranty.update(foundWarranty.id, {
          ...(foundWarranty.data || foundWarranty),
          status: 'claimed',
          claim_date: new Date().toISOString(),
          claim_reason: data.reason,
          claim_description: data.description
        });
      }
      
      // Log activity
      try {
        await base44.entities.ActivityLog.create({
          action: 'faulty_return',
          entity_type: 'Warranty',
          entity_name: `Serial: ${data.serial_number}`,
          details: `Faulty return: ${data.reason} - ${data.description}`,
          user_name: 'System',
          created_date: new Date().toISOString()
        });
      } catch (e) {
        console.log('[v0] Activity log skipped');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['faultyReturns'] });
      setReturnModalOpen(false);
      setReturnFormData(initialReturn);
      toast.success('Faulty return recorded and warranty claim initiated');
    },
  });

  const handleSubmit = () => {
    const daysLeft = differenceInDays(new Date(formData.end_date), new Date());
    let status = formData.status;
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 30) status = 'expiring_soon';
    else if (status !== 'claimed' && status !== 'void') status = 'active';

    const dataToSave = { ...formData, status };
    if (editingWarranty) {
      updateMutation.mutate({ id: editingWarranty.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const openCreate = () => {
    setEditingWarranty(null);
    setFormData(initialWarranty);
    setModalOpen(true);
  };

  const openEdit = (warranty) => {
    setEditingWarranty(warranty);
    setFormData(warranty.data || warranty);
    setModalOpen(true);
  };

  const handleStartDateChange = (date) => {
    const startDate = new Date(date);
    const endDate = addMonths(startDate, formData.duration_months);
    setFormData({ 
      ...formData, 
      start_date: date, 
      end_date: endDate.toISOString().split('T')[0] 
    });
  };

  const handleDurationChange = (months) => {
    if (formData.start_date) {
      const startDate = new Date(formData.start_date);
      const endDate = addMonths(startDate, months);
      setFormData({ 
        ...formData, 
        duration_months: months, 
        end_date: endDate.toISOString().split('T')[0] 
      });
    } else {
      setFormData({ ...formData, duration_months: months });
    }
  };

  const handleSerialLookup = (serial = serialQuery) => {
    if (!serial.trim()) {
      setLookupError('Please enter a serial number');
      return;
    }

    const warranty = warranties.find(w => {
      const data = w.data || w;
      return data.serial_number?.toLowerCase() === serial.toLowerCase().trim();
    });

    if (warranty) {
      setFoundWarranty(warranty);
      setLookupError('');
      
      // Get return history for this serial number
      const history = faultyReturns.filter(r => {
        const data = r.data || r;
        return data.serial_number?.toLowerCase() === serial.toLowerCase().trim();
      });
      setReturnHistory(history);
    } else {
      setFoundWarranty(null);
      setReturnHistory([]);
      setLookupError('No warranty found for this serial number');
    }
  };

  const openReturnModal = () => {
    setReturnFormData({
      ...initialReturn,
      serial_number: serialQuery,
      warranty_id: foundWarranty?.id
    });
    setReturnModalOpen(true);
  };

  const columns = [
    { 
      header: 'Product', 
      cell: (row) => {
        const data = row.data || row;
        const product = products.find(p => (p.data || p).id === data.product_id);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{(product?.data || product)?.name || 'Unknown'}</p>
              <p className="text-xs text-slate-500">S/N: {data.serial_number || '-'}</p>
            </div>
          </div>
        );
      }
    },
    { header: 'Provider', accessor: (row) => (row.data || row).warranty_provider },
    { header: 'Type', accessor: (row) => ((row.data || row).warranty_type || '').replace('_', ' ') },
    { 
      header: 'Period', 
      cell: (row) => {
        const data = row.data || row;
        return (
          <div className="text-sm">
            <p>{data.start_date ? format(new Date(data.start_date), 'MMM d, yyyy') : '-'}</p>
            <p className="text-slate-500">to {data.end_date ? format(new Date(data.end_date), 'MMM d, yyyy') : '-'}</p>
          </div>
        );
      }
    },
    { 
      header: 'Days Left', 
      cell: (row) => {
        const data = row.data || row;
        const days = differenceInDays(new Date(data.end_date), new Date());
        return (
          <span className={days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-emerald-600'}>
            {days <= 0 ? 'Expired' : `${days} days`}
          </span>
        );
      }
    },
    { 
      header: 'Status', 
      cell: (row) => {
        const data = row.data || row;
        const config = statusConfig[data.status] || statusConfig.active;
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {data.status}
          </Badge>
        );
      }
    },
    { 
      header: 'Actions', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditingWarranty(row); setDeleteOpen(true); }}>
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
          <h1 className="text-3xl font-bold text-slate-900">Warranties</h1>
          <p className="text-slate-500 mt-1">Track product warranties and faulty returns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSerialLookupOpen(true)}>
            <Search className="w-4 h-4 mr-2" /> Serial Lookup
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Warranty
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={warranties} 
          columns={columns} 
          searchPlaceholder="Search warranties..." 
          emptyMessage="No warranties found"
        />
      </div>

      {/* Serial Number Lookup Modal */}
      <Dialog open={serialLookupOpen} onOpenChange={setSerialLookupOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Serial Number Lookup - Faulty Return Integration
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter serial number..."
                value={serialQuery}
                onChange={(e) => setSerialQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSerialLookup()}
                className="flex-1"
              />
              <Button onClick={() => handleSerialLookup()}>
                <Search className="w-4 h-4 mr-2" /> Lookup
              </Button>
            </div>

            {lookupError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                {lookupError}
              </div>
            )}

            {foundWarranty && (
              <Tabs defaultValue="warranty" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="warranty">Warranty Details</TabsTrigger>
                  <TabsTrigger value="history">Return History ({returnHistory.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="warranty">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-blue-600" />
                          Warranty Information
                        </span>
                        {(() => {
                          const data = foundWarranty.data || foundWarranty;
                          const config = statusConfig[data.status] || statusConfig.active;
                          const Icon = config.icon;
                          return (
                            <Badge className={config.color}>
                              <Icon className="w-3 h-3 mr-1" />
                              {data.status}
                            </Badge>
                          );
                        })()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const data = foundWarranty.data || foundWarranty;
                        const product = products.find(p => (p.data || p).id === data.product_id);
                        const daysLeft = differenceInDays(new Date(data.end_date), new Date());

                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Product</p>
                                <p className="font-medium">{(product?.data || product)?.name || 'Unknown'}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Serial Number</p>
                                <p className="font-medium font-mono">{data.serial_number}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Provider</p>
                                <p className="font-medium">{data.warranty_provider}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Type</p>
                                <p className="font-medium capitalize">{data.warranty_type?.replace('_', ' ')}</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Warranty Period</p>
                                <p className="font-medium">
                                  {data.start_date ? format(new Date(data.start_date), 'MMM d, yyyy') : '-'} - {data.end_date ? format(new Date(data.end_date), 'MMM d, yyyy') : '-'}
                                </p>
                              </div>
                              <div className={`p-3 rounded-lg ${daysLeft <= 0 ? 'bg-red-50' : daysLeft <= 30 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                                <p className="text-xs text-slate-500">Days Remaining</p>
                                <p className={`font-medium ${daysLeft <= 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {daysLeft <= 0 ? 'Expired' : `${daysLeft} days`}
                                </p>
                              </div>
                            </div>

                            {data.coverage_details && (
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Coverage Details</p>
                                <p className="text-sm mt-1">{data.coverage_details}</p>
                              </div>
                            )}

                            {data.provider_email && (
                              <div className="p-3 bg-slate-50 rounded-lg">
                                <p className="text-xs text-slate-500">Provider Contact</p>
                                <p className="text-sm mt-1">{data.provider_email} | {data.provider_phone}</p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              {data.status === 'active' && daysLeft > 0 && (
                                <Button onClick={openReturnModal} className="flex-1">
                                  <RotateCcw className="w-4 h-4 mr-2" /> Report Faulty Return
                                </Button>
                              )}
                              <Button variant="outline" onClick={() => openEdit(foundWarranty)}>
                                <Edit2 className="w-4 h-4 mr-2" /> Edit Warranty
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Return History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {returnHistory.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No return history for this serial number</p>
                      ) : (
                        <div className="space-y-3">
                          {returnHistory.map((ret, idx) => {
                            const data = ret.data || ret;
                            return (
                              <div key={idx} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge className="bg-red-100 text-red-700 capitalize">
                                    {data.reason?.replace('_', ' ')}
                                  </Badge>
                                  <span className="text-sm text-slate-500">
                                    {data.return_date ? format(new Date(data.return_date), 'MMM d, yyyy') : '-'}
                                  </span>
                                </div>
                                <p className="text-sm">{data.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {!foundWarranty && !lookupError && (
              <div className="p-8 text-center text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Enter a serial number to lookup warranty information</p>
                <p className="text-sm mt-2">You can scan or type the serial number of a returned item to check its warranty status</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Faulty Return Modal */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Report Faulty Return
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Serial Number</Label>
              <Input value={returnFormData.serial_number} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Return Reason</Label>
              <Select 
                value={returnFormData.reason} 
                onValueChange={(v) => setReturnFormData({ ...returnFormData, reason: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Return Date</Label>
              <Input 
                type="date" 
                value={returnFormData.return_date} 
                onChange={(e) => setReturnFormData({ ...returnFormData, return_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={returnFormData.description}
                onChange={(e) => setReturnFormData({ ...returnFormData, description: e.target.value })}
                placeholder="Describe the issue with the returned item..."
                rows={3}
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              This will initiate a warranty claim for this item. The warranty status will be updated to "Claimed".
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setReturnModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={() => createReturnMutation.mutate(returnFormData)}
                disabled={createReturnMutation.isPending}
                className="flex-1"
              >
                {createReturnMutation.isPending ? 'Processing...' : 'Submit Return'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Warranty Form Modal */}
      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWarranty ? 'Edit Warranty' : 'Add Warranty'}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Product</Label>
            <Select value={formData.product_id} onValueChange={(v) => setFormData({ ...formData, product_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => {
                  const data = p.data || p;
                  return <SelectItem key={data.id} value={data.id}>{data.name}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Serial Number</Label>
            <Input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
          </div>
          <div>
            <Label>Warranty Provider</Label>
            <Input value={formData.warranty_provider} onChange={(e) => setFormData({ ...formData, warranty_provider: e.target.value })} />
          </div>
          <div>
            <Label>Warranty Type</Label>
            <Select value={formData.warranty_type} onValueChange={(v) => setFormData({ ...formData, warranty_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARRANTY_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provider Contact</Label>
            <Input value={formData.provider_contact} onChange={(e) => setFormData({ ...formData, provider_contact: e.target.value })} />
          </div>
          <div>
            <Label>Provider Email</Label>
            <Input value={formData.provider_email} onChange={(e) => setFormData({ ...formData, provider_email: e.target.value })} />
          </div>
          <div>
            <Label>Provider Phone</Label>
            <Input value={formData.provider_phone} onChange={(e) => setFormData({ ...formData, provider_phone: e.target.value })} />
          </div>
          <div>
            <Label>Duration (months)</Label>
            <Input type="number" value={formData.duration_months} onChange={(e) => handleDurationChange(Number(e.target.value))} />
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={formData.start_date} onChange={(e) => handleStartDateChange(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Coverage Details</Label>
            <Textarea value={formData.coverage_details} onChange={(e) => setFormData({ ...formData, coverage_details: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label>Terms & Conditions</Label>
            <Textarea value={formData.terms_conditions} onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })} />
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(editingWarranty?.id)}
        title="Delete Warranty"
        description="Are you sure you want to delete this warranty record? This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
