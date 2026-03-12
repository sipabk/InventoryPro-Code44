import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Settings as SettingsIcon, DollarSign, Bell, Calendar, Database, Shield, Save, Loader2, Plus, X, AlertTriangle, Trash2, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const PRESET_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

const defaultSettings = {
  // General
  company_name: '',
  timezone: 'UTC',
  date_format: 'MM/dd/yyyy',
  // Financial
  default_currency: 'USD',
  financial_year_start: '01',
  tax_rate: 0,
  valuation_method: 'weighted_average',
  custom_currencies: '',
  // Notifications
  low_stock_alert: true,
  warranty_expiry_alert: true,
  warranty_alert_days: 30,
  email_notifications: true,
  // Backup
  auto_backup: false,
  backup_frequency: 'weekly',
};

export default function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');
  
  // Admin panel state
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearingData, setClearingData] = useState(false);
  const [preserveSettings, setPreserveSettings] = useState(true);
  const [preserveUsers, setPreserveUsers] = useState(true);
  const [clearProgress, setClearProgress] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: existingSettings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.SystemSettings.list(),
  });

  useEffect(() => {
    if (existingSettings.length > 0) {
      const loadedSettings = { ...defaultSettings };
      existingSettings.forEach(s => {
        if (s.setting_key in loadedSettings) {
          loadedSettings[s.setting_key] = s.setting_value === 'true' ? true : 
            s.setting_value === 'false' ? false : 
            !isNaN(s.setting_value) ? parseFloat(s.setting_value) : s.setting_value;
        }
      });
      setSettings(loadedSettings);
    }
  }, [existingSettings]);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      for (const [key, value] of Object.entries(settings)) {
        const existing = existingSettings.find(s => s.setting_key === key);
        const stringValue = String(value);
        
        if (existing) {
          await base44.entities.SystemSettings.update(existing.id, { setting_value: stringValue });
        } else {
          await base44.entities.SystemSettings.create({ 
            setting_key: key, 
            setting_value: stringValue,
            setting_type: key.includes('currency') || key.includes('tax') || key.includes('financial') ? 'financial' :
              key.includes('alert') || key.includes('notification') ? 'notification' :
              key.includes('backup') ? 'backup' : 'general'
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
    
    setSaving(false);
  };

  const customCurrencies = settings.custom_currencies ? settings.custom_currencies.split(',').filter(c => c.trim()) : [];

  const ENTITIES_TO_CLEAR = [
    { key: 'Product', label: 'Products' },
    { key: 'Category', label: 'Categories' },
    { key: 'Warehouse', label: 'Warehouses' },
    { key: 'Supplier', label: 'Suppliers' },
    { key: 'StockTransaction', label: 'Stock Transactions' },
    { key: 'Warranty', label: 'Warranties' },
    { key: 'PurchaseOrder', label: 'Purchase Orders' },
    { key: 'ActivityLog', label: 'Activity Logs' },
    { key: 'ScheduledReport', label: 'Scheduled Reports' },
    { key: 'FaultyReturn', label: 'Faulty Returns' },
  ];

  const handleClearAllData = async () => {
    if (confirmText !== 'DELETE ALL DATA') {
      toast.error('Please type "DELETE ALL DATA" to confirm');
      return;
    }

    setClearingData(true);
    setClearProgress({ current: 0, total: ENTITIES_TO_CLEAR.length, entity: '' });

    try {
      for (let i = 0; i < ENTITIES_TO_CLEAR.length; i++) {
        const entity = ENTITIES_TO_CLEAR[i];
        setClearProgress({ current: i + 1, total: ENTITIES_TO_CLEAR.length, entity: entity.label });

        try {
          const items = await base44.entities[entity.key]?.list?.();
          if (items && items.length > 0) {
            for (const item of items) {
              try {
                await base44.entities[entity.key].delete(item.id);
              } catch (e) {
                console.log(`[v0] Failed to delete ${entity.key} item:`, e);
              }
            }
          }
        } catch (e) {
          console.log(`[v0] Entity ${entity.key} not found or error:`, e);
        }
      }

      // Clear settings if not preserved
      if (!preserveSettings) {
        try {
          const settingsItems = await base44.entities.SystemSettings.list();
          for (const item of settingsItems) {
            await base44.entities.SystemSettings.delete(item.id);
          }
        } catch (e) {
          console.log('[v0] Settings clear error:', e);
        }
      }

      // Clear users if not preserved
      if (!preserveUsers) {
        try {
          const users = await base44.entities.User?.list?.();
          if (users) {
            for (const user of users) {
              await base44.entities.User.delete(user.id);
            }
          }
        } catch (e) {
          console.log('[v0] Users clear error:', e);
        }
      }

      // Log the clear action
      try {
        await base44.entities.ActivityLog.create({
          action: 'clear_all_data',
          entity_type: 'System',
          entity_name: 'All Data',
          details: `Cleared all data. Preserved settings: ${preserveSettings}, Preserved users: ${preserveUsers}`,
          user_name: 'Admin',
          created_date: new Date().toISOString()
        });
      } catch (e) {
        console.log('[v0] Activity log creation skipped');
      }

      // Invalidate all queries
      queryClient.invalidateQueries();
      
      setClearDataDialogOpen(false);
      setConfirmText('');
      setClearProgress(null);
      toast.success('All data has been cleared successfully');
    } catch (error) {
      console.error('[v0] Clear data error:', error);
      toast.error('Failed to clear all data');
    }

    setClearingData(false);
  };
  
  const addCurrency = () => {
    if (newCurrency && !customCurrencies.includes(newCurrency.toUpperCase())) {
      const updated = [...customCurrencies, newCurrency.toUpperCase()].join(',');
      setSettings({ ...settings, custom_currencies: updated });
      setNewCurrency('');
    }
  };

  const removeCurrency = (currency) => {
    const updated = customCurrencies.filter(c => c !== currency).join(',');
    setSettings({ ...settings, custom_currencies: updated });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Configure your inventory system</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> General Settings
              </CardTitle>
              <CardDescription>Basic system configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name</Label>
                  <Input 
                    value={settings.company_name} 
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    placeholder="Your Company Name"
                  />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date Format</Label>
                  <Select value={settings.date_format} onValueChange={(v) => setSettings({ ...settings, date_format: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" /> Financial Settings
              </CardTitle>
              <CardDescription>Currency and tax configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default Currency</Label>
                  <Select value={settings.default_currency} onValueChange={(v) => setSettings({ ...settings, default_currency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...PRESET_CURRENCIES, ...customCurrencies].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Tax Rate (%)</Label>
                  <Input 
                    type="number" 
                    value={settings.tax_rate} 
                    onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Valuation Method</Label>
                  <Select value={settings.valuation_method} onValueChange={(v) => setSettings({ ...settings, valuation_method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weighted_average">Weighted Average</SelectItem>
                      <SelectItem value="fifo">FIFO</SelectItem>
                      <SelectItem value="lifo">LIFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Financial Year Start</Label>
                  <Select value={settings.financial_year_start} onValueChange={(v) => setSettings({ ...settings, financial_year_start: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <SelectItem key={m} value={m}>Month {m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Custom Currencies</Label>
                <div className="flex gap-2 mt-2">
                  <Input 
                    placeholder="e.g., BTC" 
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                    className="w-32"
                  />
                  <Button variant="outline" onClick={addCurrency}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {customCurrencies.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm">
                      {c}
                      <button onClick={() => removeCurrency(c)} className="text-slate-500 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" /> Notification Settings
              </CardTitle>
              <CardDescription>Configure alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Low Stock Alerts</p>
                  <p className="text-sm text-slate-500">Get notified when stock falls below reorder level</p>
                </div>
                <Switch 
                  checked={settings.low_stock_alert} 
                  onCheckedChange={(v) => setSettings({ ...settings, low_stock_alert: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Warranty Expiry Alerts</p>
                  <p className="text-sm text-slate-500">Get notified before warranties expire</p>
                </div>
                <Switch 
                  checked={settings.warranty_expiry_alert} 
                  onCheckedChange={(v) => setSettings({ ...settings, warranty_expiry_alert: v })}
                />
              </div>
              {settings.warranty_expiry_alert && (
                <div>
                  <Label>Alert Days Before Expiry</Label>
                  <Input 
                    type="number" 
                    value={settings.warranty_alert_days} 
                    onChange={(e) => setSettings({ ...settings, warranty_alert_days: parseInt(e.target.value) || 30 })}
                    className="w-32"
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-slate-500">Receive notifications via email</p>
                </div>
                <Switch 
                  checked={settings.email_notifications} 
                  onCheckedChange={(v) => setSettings({ ...settings, email_notifications: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" /> Backup Settings
              </CardTitle>
              <CardDescription>Data backup configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatic Backups</p>
                  <p className="text-sm text-slate-500">Automatically backup your data</p>
                </div>
                <Switch 
                  checked={settings.auto_backup} 
                  onCheckedChange={(v) => setSettings({ ...settings, auto_backup: v })}
                />
              </div>
              {settings.auto_backup && (
                <div>
                  <Label>Backup Frequency</Label>
                  <Select value={settings.backup_frequency} onValueChange={(v) => setSettings({ ...settings, backup_frequency: v })}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Shield className="w-5 h-5" /> Admin Panel
              </CardTitle>
              <CardDescription>Dangerous operations - Admin only</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-red-800">Clear All Data</h3>
                    <p className="text-sm text-red-700">
                      This action will permanently delete all inventory data including products, categories, 
                      warehouses, suppliers, transactions, warranties, and reports. This cannot be undone.
                    </p>
                    <Button 
                      variant="destructive" 
                      onClick={() => setClearDataDialogOpen(true)}
                      className="mt-2"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Clear All Data
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-amber-800">Reset to Default State</h3>
                    <p className="text-sm text-amber-700">
                      Clears all data and resets system settings to defaults. Useful for starting fresh 
                      before a new import or for demo purposes.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPreserveSettings(false);
                        setPreserveUsers(true);
                        setClearDataDialogOpen(true);
                      }}
                      className="mt-2 border-amber-400 text-amber-700 hover:bg-amber-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Reset System
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clear All Data Confirmation Dialog */}
      <Dialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Confirm Data Deletion
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <p className="font-medium mb-2">The following data will be deleted:</p>
              <ul className="list-disc list-inside space-y-1">
                {ENTITIES_TO_CLEAR.map(e => (
                  <li key={e.key}>{e.label}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={preserveSettings}
                  onCheckedChange={setPreserveSettings}
                />
                <span className="text-sm">Preserve system settings</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={preserveUsers}
                  onCheckedChange={setPreserveUsers}
                />
                <span className="text-sm">Preserve user accounts</span>
              </label>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Type <span className="font-mono bg-slate-100 px-1">DELETE ALL DATA</span> to confirm:
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE ALL DATA"
                className="mt-2 font-mono"
                disabled={clearingData}
              />
            </div>

            {clearProgress && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Clearing {clearProgress.entity}...</span>
                  <span>{clearProgress.current} / {clearProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all duration-300"
                    style={{ width: `${(clearProgress.current / clearProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setClearDataDialogOpen(false);
                setConfirmText('');
              }}
              disabled={clearingData}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleClearAllData}
              disabled={confirmText !== 'DELETE ALL DATA' || clearingData}
            >
              {clearingData ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
