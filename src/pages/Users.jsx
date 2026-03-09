import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Edit2, Users, Shield, Mail, Loader2 } from "lucide-react";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import { toast } from "sonner";
import { format } from 'date-fns';

const ROLES = ['admin', 'manager', 'staff', 'viewer'];

const roleColors = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  staff: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-100 text-slate-700',
};

export default function UsersPage() {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [editingUser, setEditingUser] = useState(null);
  const [inviting, setInviting] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditModalOpen(false);
      toast.success('User updated successfully');
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    setInviteModalOpen(false);
    setInviteEmail('');
    toast.success('Invitation sent successfully');
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditModalOpen(true);
  };

  const columns = [
    { 
      header: 'User', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold">
              {(row.full_name || row.email || '?')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-slate-800">{row.full_name || '-'}</p>
            <p className="text-xs text-slate-500">{row.email}</p>
          </div>
        </div>
      )
    },
    { 
      header: 'Role', 
      cell: (row) => (
        <Badge className={roleColors[row.role] || roleColors.viewer}>
          <Shield className="w-3 h-3 mr-1" />
          {row.role || 'user'}
        </Badge>
      )
 