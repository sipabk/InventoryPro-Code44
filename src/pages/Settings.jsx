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
import { Settings as SettingsIcon, DollarSign, Bell, Calendar, Database, Shield, Save, Loader2, Plus, X, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from '@/lib/AuthContext';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";

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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

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

  const handleClearAllData = async () => {
    setClearing(true);
    const entities = ['Product', 'StockTransaction', 'Warranty', 'PurchaseOrder', 'PurchaseOrderItem', 'StockAdjustment', 'ActivityLog', 'ScheduledReport'];
    for (const entityName of entities) {
      const records = await base44.entities[entityName].list();
      for (const r of records) {
        await base44.entities[entityName].delete(r.id).catch(() => { });
      }
    }
    setClearing(false);
    setClearConfirmOpen(false);
    queryClient.invalidateQueries();
    toast.success('All data cleared successfully');
  };

  const handleSave = async () => {
    setSaving(true);

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
    setSaving(false);
    toast.success('Settings saved successfully');
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Configure your inventory system</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'admin' && (
            <Button variant="destructive" onClick={() => setClearConfirmOpen(true)} disabled={clearing}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="w-4 h-4" /> General
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <DollarSign className="w-4 h-4" /> Financial
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="w-4 h-4" /> Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic configuration for your system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={settings.company_name}
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    placeholder="Your Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      <SelectItem value="Asia/Kolkata">India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select value={settings.date_format} onValueChange={(v) => setSettings({ ...settings, date_format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
              <CardTitle>Financial Settings</CardTitle>
              <CardDescription>Currency, tax, and valuation configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select value={settings.default_currency} onValueChange={(v) => setSettings({ ...settings, default_currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[...PRESET_CURRENCIES, ...(settings.custom_currencies ? settings.custom_currencies.split(',').map(c => c.trim()).filter(Boolean) : [])].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Financial Year Start Month</Label>
                  <Select value={settings.financial_year_start} onValueChange={(v) => setSettings({ ...settings, financial_year_start: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                        <SelectItem key={m} value={m}>
                          {new Date(2000, parseInt(m) - 1).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={settings.tax_rate}
                    onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Custom Currencies</Label>
                  <p className="text-xs text-slate-500">Add custom currency codes (e.g. AED, SGD, BRL)</p>
                  <div className="flex gap-2">
                    <Input
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                      placeholder="e.g. AED"
                      maxLength={5}
                      className="w-32"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCurrency.trim()) {
                          const existing = settings.custom_currencies ? settings.custom_currencies.split(',').map(c => c.trim()).filter(Boolean) : [];
                          if (!existing.includes(newCurrency.trim()) && !PRESET_CURRENCIES.includes(newCurrency.trim())) {
                            setSettings({ ...settings, custom_currencies: [...existing, newCurrency.trim()].join(',') });
                          }
                          setNewCurrency('');
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      if (newCurrency.trim()) {
                        const existing = settings.custom_currencies ? settings.custom_currencies.split(',').map(c => c.trim()).filter(Boolean) : [];
                        if (!existing.includes(newCurrency.trim()) && !PRESET_CURRENCIES.includes(newCurrency.trim())) {
                          setSettings({ ...settings, custom_currencies: [...existing, newCurrency.trim()].join(',') });
                        }
                        setNewCurrency('');
                      }
                    }}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(settings.custom_currencies ? settings.custom_currencies.split(',').map(c => c.trim()).filter(Boolean) : []).map(c => (
                      <span key={c} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                        {c}
                        <button onClick={() => {
                          const existing = settings.custom_currencies.split(',').map(x => x.trim()).filter(x => x && x !== c);
                          setSettings({ ...settings, custom_currencies: existing.join(',') });
                        }}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Default Valuation Method</Label>
                  <Select value={settings.valuation_method} onValueChange={(v) => setSettings({ ...settings, valuation_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
                      <SelectItem value="lifo">LIFO (Last In, First Out)</SelectItem>
                      <SelectItem value="weighted_average">Weighted Average</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">Low Stock Alerts</p>
                    <p className="text-sm text-slate-500">Get notified when items fall below reorder level</p>
                  </div>
                  <Switch
                    checked={settings.low_stock_alert}
                    onCheckedChange={(v) => setSettings({ ...settings, low_stock_alert: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
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
                  <div className="space-y-2 pl-4">
                    <Label>Alert Days Before Expiry</Label>
                    <Input
                      type="number"
                      value={settings.warranty_alert_days}
                      onChange={(e) => setSettings({ ...settings, warranty_alert_days: parseInt(e.target.value) || 30 })}
                      className="max-w-32"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-slate-500">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.email_notifications}
                    onCheckedChange={(v) => setSettings({ ...settings, email_notifications: v })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore</CardTitle>
              <CardDescription>Data backup configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Automatic Backup</p>
                  <p className="text-sm text-slate-500">Automatically backup your data</p>
                </div>
                <Switch
                  checked={settings.auto_backup}
                  onCheckedChange={(v) => setSettings({ ...settings, auto_backup: v })}
                />
              </div>
              {settings.auto_backup && (
                <div className="space-y-2">
                  <Label>Backup Frequency</Label>
                  <Select value={settings.backup_frequency} onValueChange={(v) => setSettings({ ...settings, backup_frequency: v })}>
                    <SelectTrigger className="max-w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-4">
                <Button variant="outline">
                  <Database className="w-4 h-4 mr-2" />
                  Backup Now
                </Button>
                <Button variant="outline">
                  <Database className="w-4 h-4 mr-2" />
                  Restore from Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleClearAllData}
        title="Clear All Data"
        description="⚠️ This will permanently delete ALL inventory data including products, transactions, warranties, purchase orders, adjustments, and activity logs. This cannot be undone. Are you absolutely sure?"
        confirmLabel={clearing ? 'Clearing...' : 'Yes, Clear Everything'}
        isLoading={clearing}
      />
    </div>
  );
}