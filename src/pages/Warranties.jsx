import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Shield, AlertTriangle, CheckCircle, XCircle, Clock, Search, QrCode, RotateCcw, History, Package } from "lucide-react";
import { format, differenceInDays, addMonths } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";

const WARRANTY_TYPES = ['manufacturer', 'extended', 'third_party', 'in_house'];
const STATUSES = ['active', 'expired', 'expiring_soon', 'claimed', 'void'];
const CLAIM_TYPES = ['repair', 'replacement', 'refund', 'partial_refund'];

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

const initialClaim = {
  claim_type: 'repair',
  issue_description: '',
  return_date: new Date().toISOString().split('T')[0],
  resolution: '',
  resolution_date: '',
  claim_status: 'pending',
  notes: ''
};

export default function Warranties() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState(null);
  const [formData, setFormData] = useState(initialWarranty);
  
  // Serial number lookup
  const [serialSearchTerm, setSerialSearchTerm] = useState('');
  const [showSerialLookup, setShowSerialLookup] = useState(false);
  const [foundWarranty, setFoundWarranty] = useState(null);
  
  // Claims/Returns tracking
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimData, setClaimData] = useState(initialClaim);
  const [claimHistory, setClaimHistory] = useState([]);
  
  const queryClient = useQueryClient();

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Warranty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty created successfully');
      logActivity('create', 'Warranty', formData.serial_number, 'New warranty registered');
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

  // Log activity helper
  const logActivity = async (action, entityType, entityName, details) => {
    try {
      await base44.entities.ActivityLog?.create({
        action,
        entity_type: entityType,
        entity_name: entityName,
        details,
        user_name: 'System',
        created_date: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  };

  // Serial Number Lookup
  const handleSerialLookup = () => {
    if (!serialSearchTerm.trim()) {
      toast.error('Please enter a serial number');
      return;
    }
    
    const found = warranties.find(w => 
      w.serial_number?.toLowerCase() === serialSearchTerm.toLowerCase()
    );
    
    if (found) {
      setFoundWarranty(found);
      setShowSerialLookup(true);
      
      // Log the lookup
      logActivity('read', 'Warranty', found.serial_number, `Serial number lookup for faulty return: ${serialSearchTerm}`);
      
      toast.success('Warranty record found');
    } else {
      // Check if serial exists in products
      const product = products.find(p => 
        p.barcode?.toLowerCase() === serialSearchTerm.toLowerCase() ||
        p.sku?.toLowerCase() === serialSearchTerm.toLowerCase()
      );
      
      if (product) {
        toast.warning('Product found but no warranty record exists. Create a new warranty?');
        setFormData({ ...initialWarranty, product_id: product.id, serial_number: serialSearchTerm });
        setModalOpen(true);
      } else {
        toast.error('No warranty found for this serial number');
      }
    }
  };

  // Register a claim/faulty return
  const handleRegisterClaim = () => {
    if (!foundWarranty) return;
    
    const updatedClaims = [...(foundWarranty.claims || []), {
      ...claimData,
      id: Date.now(),
      created_date: new Date().toISOString()
    }];
    
    updateMutation.mutate({
      id: foundWarranty.id,
      data: {
        ...foundWarranty,
        claims: updatedClaims,
        status: 'claimed',
        last_claim_date: new Date().toISOString()
      }
    });
    
    logActivity('update', 'Warranty', foundWarranty.serial_number, 
      `Faulty return registered: ${claimData.claim_type} - ${claimData.issue_description}`);
    
    setShowClaimModal(false);
    setClaimData(initialClaim);
    toast.success('Faulty return/claim registered successfully');
  };

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
    setFormData(warranty);
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

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: warranties.length,
      active: warranties.filter(w => {
        const days = differenceInDays(new Date(w.end_date), today);
        return days > 30 && w.status !== 'claimed' && w.status !== 'void';
      }).length,
      expiringSoon: warranties.filter(w => {
        const days = differenceInDays(new Date(w.end_date), today);
        return days >= 0 && days <= 30;
      }).length,
      claimed: warranties.filter(w => w.status === 'claimed').length,
      expired: warranties.filter(w => differenceInDays(new Date(w.end_date), today) < 0).length,
    };
  }, [warranties]);

  const columns = [
    { 
      header: 'Product', 
      cell: (row) => {
        const product = products.find(p => p.id === row.product_id);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{product?.name || 'Unknown'}</p>
              <p className="text-xs text-slate-500">S/N: {row.serial_number || '-'}</p>
            </div>
          </div>
        );
      }
    },
    { header: 'Provider', accessor: 'warranty_provider' },
    { header: 'Type', accessor: (row) => row.warranty_type?.replace('_', ' ') },
    { 
      header: 'Period', 
      cell: (row) => (
        <div className="text-sm">
          <p>{row.start_date ? format(new Date(row.start_date), 'MMM d, yyyy') : '-'}</p>
          <p className="text-slate-500">to {row.end_date ? format(new Date(row.end_date), 'MMM d, yyyy') : '-'}</p>
        </div>
      )
    },
    { 
      header: 'Days Left', 
      cell: (row) => {
        const days = differenceInDays(new Date(row.end_date), new Date());
        return (
          <span className={days <= 0 ? 'text-red-600 font-medium' : days <= 30 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
            {days <= 0 ? 'Expired' : `${days} days`}
          </span>
        );
      }
    },
    { 
      header: 'Claims', 
      cell: (row) => (
        <Badge variant="outline">
          {(row.claims || []).length} claims
        </Badge>
      )
    },
    { 
      header: 'Status', 
      cell: (row) => {
        const config = statusConfig[row.status] || statusConfig.active;
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {row.status}
          </Badge>
        );
      }
    },
    { 
      header: 'Actions', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => {
            setFoundWarranty(row);
            setShowSerialLookup(true);
          }} title="View Details">
            <History className="w-4 h-4" />
          </Button>
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
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Warranty
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Shield className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Active</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Expiring Soon</p>
                <p className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Claimed</p>
                <p className="text-2xl font-bold text-blue-600">{stats.claimed}</p>
              </div>
              <RotateCcw className="w-8 h-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Expired</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Serial Number Lookup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" /> Serial Number Lookup (Faulty Returns)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Enter or scan serial number..."
                value={serialSearchTerm}
                onChange={(e) => setSerialSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSerialLookup()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSerialLookup}>
              <Search className="w-4 h-4 mr-2" /> Look Up
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Enter a product serial number to check warranty status and register faulty returns
          </p>
        </CardContent>
      </Card>

      {/* Warranties Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={warranties} 
          columns={columns} 
          searchPlaceholder="Search warranties..." 
          emptyMessage="No warranties found"
        />
      </div>

      {/* Warranty Form Modal */}
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
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Serial Number *</Label>
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
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
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

      {/* Serial Lookup / Warranty Details Modal */}
      <Dialog open={showSerialLookup} onOpenChange={setShowSerialLookup}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" /> Warranty Details
            </DialogTitle>
          </DialogHeader>
          
          {foundWarranty && (
            <Tabs defaultValue="details" className="space-y-4">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="claims">Claims History</TabsTrigger>
                <TabsTrigger value="register">Register Return</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">Serial Number</p>
                    <p className="font-mono font-bold text-lg">{foundWarranty.serial_number}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">Status</p>
                    <Badge className={statusConfig[foundWarranty.status]?.color}>
                      {foundWarranty.status}
                    </Badge>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">Product</p>
                    <p className="font-medium">{products.find(p => p.id === foundWarranty.product_id)?.name || 'Unknown'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">Days Left</p>
                    <p className="font-medium">
                      {(() => {
                        const days = differenceInDays(new Date(foundWarranty.end_date), new Date());
                        return days <= 0 ? 'Expired' : `${days} days`;
                      })()}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg col-span-2">
                    <p className="text-xs text-slate-500 uppercase">Warranty Period</p>
                    <p className="font-medium">
                      {format(new Date(foundWarranty.start_date), 'MMM d, yyyy')} - {format(new Date(foundWarranty.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">Provider</p>
                    <p className="font-medium">{foundWarranty.warranty_provider || '-'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase">Type</p>
                    <p className="font-medium capitalize">{foundWarranty.warranty_type?.replace('_', ' ')}</p>
                  </div>
                </div>
                
                {foundWarranty.coverage_details && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase mb-2">Coverage Details</p>
                    <p className="text-sm">{foundWarranty.coverage_details}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="claims" className="space-y-4">
                {(foundWarranty.claims || []).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>No claims registered for this warranty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(foundWarranty.claims || []).map((claim, index) => (
                      <div key={claim.id || index} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className="capitalize">{claim.claim_type}</Badge>
                            <p className="font-medium mt-2">{claim.issue_description}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Returned: {format(new Date(claim.return_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant="outline">{claim.claim_status}</Badge>
                        </div>
                        {claim.resolution && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-slate-500">Resolution:</p>
                            <p className="text-sm">{claim.resolution}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-lg text-amber-800 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Use this form to register a faulty return or warranty claim for this product.
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label>Claim Type</Label>
                    <Select value={claimData.claim_type} onValueChange={(v) => setClaimData({ ...claimData, claim_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLAIM_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Issue Description *</Label>
                    <Textarea 
                      value={claimData.issue_description}
                      onChange={(e) => setClaimData({ ...claimData, issue_description: e.target.value })}
                      placeholder="Describe the issue with the product..."
                    />
                  </div>
                  
                  <div>
                    <Label>Return Date</Label>
                    <Input 
                      type="date" 
                      value={claimData.return_date}
                      onChange={(e) => setClaimData({ ...claimData, return_date: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Additional Notes</Label>
                    <Textarea 
                      value={claimData.notes}
                      onChange={(e) => setClaimData({ ...claimData, notes: e.target.value })}
                      placeholder="Any additional notes..."
                    />
                  </div>
                  
                  <Button 
                    onClick={handleRegisterClaim} 
                    disabled={!claimData.issue_description}
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Register Faulty Return
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

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
