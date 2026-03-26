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
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteModalOpen(false);
      setInviteEmail('');
      toast.success('Invitation sent successfully');
    } catch (error) {
      toast.error('Failed to send invitation');
    }
    setInviting(false);
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
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <Badge className={row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
          {row.status || 'active'}
        </Badge>
      )
    },
    { 
      header: 'Last Login', 
      accessor: (row) => row.last_login ? format(new Date(row.last_login), 'MMM d, yyyy') : 'Never'
    },
    { 
      header: 'Actions', 
      cell: (row) => (
        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
          <Edit2 className="w-4 h-4" />
        </Button>
      )
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1">Manage team members and access</p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Invite User
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={users} 
          columns={columns} 
          searchPlaceholder="Search users..." 
          emptyMessage="No users found"
        />
      </div>

      {/* Invite Modal */}
      <FormModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite User"
        onSubmit={handleInvite}
        submitLabel="Send Invitation"
        isLoading={inviting}
      >
        <div className="space-y-4">
          <div>
            <Label>Email Address</Label>
            <Input 
              type="email" 
              placeholder="user@example.com"
              value={inviteEmail} 
              onChange={(e) => setInviteEmail(e.target.value)} 
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormModal>

      {/* Edit Modal */}
      <FormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User"
        onSubmit={() => updateMutation.mutate({ 
          id: editingUser?.id, 
          data: { role: editingUser?.role, status: editingUser?.status } 
        })}
        isLoading={updateMutation.isPending}
      >
        {editingUser && (
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={editingUser.email} disabled />
            </div>
            <div>
              <Label>Full Name</Label>
              <Input value={editingUser.full_name || ''} disabled />
            </div>
            <div>
              <Label>Role</Label>
              <Select 
                value={editingUser.role || 'viewer'} 
                onValueChange={(v) => setEditingUser({ ...editingUser, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select 
                value={editingUser.status || 'active'} 
                onValueChange={(v) => setEditingUser({ ...editingUser, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
