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
import { Settings as SettingsIcon, DollarSign, Bell, Calendar, Database, Shield, Save, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

const PRESET_CURRENCIES = ['BWP', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

const defaultSettings = {
  // General
  company_name: '',
  timezone: 'UTC',
  date_format: 'MM/dd/yyyy',
  // Financial
  default_currency: 'BWP',
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
      </Tabs>
    </div>
  );
}
