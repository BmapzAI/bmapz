import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, List, Trash2, Users, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function LeadListManager({ companyId }) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const { data: leadLists = [] } = useQuery({
    queryKey: ['leadLists', companyId],
    queryFn: () => companyId ? LeadList.filter({ company_id: companyId }) : [],
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => LeadList.create({
      ...data,
      company_id: companyId,
      lead_ids: [],
      lead_count: 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadLists'] });
      toast.success('List created');
      setShowCreateDialog(false);
      setFormData({ name: '', description: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => LeadList.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadLists'] });
      toast.success('List updated');
      setEditingList(null);
      setShowCreateDialog(false);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => LeadList.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadLists'] });
      toast.success('List deleted');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('List name is required');
      return;
    }

    if (editingList) {
      updateMutation.mutate({ id: editingList.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (list) => {
    setEditingList(list);
    setFormData({ name: list.name, description: list.description || '' });
    setShowCreateDialog(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this list?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Lead Lists</h3>
        <Button
          onClick={() => {
            setEditingList(null);
            setFormData({ name: '', description: '' });
            setShowCreateDialog(true);
          }}
          className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
          size="sm"
        >
          <Plus size={16} />
          New List
        </Button>
      </div>

      <div className="grid gap-3">
        {leadLists.map((list) => (
          <div
            key={list.id}
            className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <List size={16} className="text-[#38b6ff]" />
                  <h4 className="text-white font-medium">{list.name}</h4>
                </div>
                {list.description && (
                  <p className="text-sm text-gray-400 mb-2">{list.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Users size={12} />
                  <span>{list.lead_count || 0} leads</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(list)}
                  className="text-gray-400 hover:text-white h-8 w-8"
                >
                  <Edit size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(list.id)}
                  className="text-gray-400 hover:text-red-400 h-8 w-8"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {leadLists.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <List size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No lists yet. Create one to organize your leads.</p>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingList ? 'Edit List' : 'Create New List'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-400">List Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., High Priority Leads"
                className="mt-1.5 bg-black/30 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What's this list for?"
                className="mt-1.5 bg-black/30 border-white/10 text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setEditingList(null);
                  setFormData({ name: '', description: '' });
                }}
                className="border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-gradient-to-r from-[#3572b9] to-[#38b6ff]"
              >
                {editingList ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}