import { api } from '@/api/apiClient';
import React, { useState, useEffect, useRef } from 'react';

import { useLanguage } from '@/components/ui/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User, Mail, Phone, Camera, Save, Shield, Clock, Building2, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Company } from '@/api/entities';
import { UploadFile } from '@/api/integrations';

export default function Profile() {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    timezone: 'UTC',
    profile_picture: '',
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { user: userData } = await api.get('/api/auth/me');
        setUser(userData);
        setFormData({
          full_name: userData.full_name || '',
          phone: userData.phone || '',
          timezone: userData.timezone || 'UTC',
          profile_picture: userData.profile_picture || '',
        });
      } catch (error) {
        console.log('User not loaded');
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
  });

  const company = companies[0];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/api/users/me', formData);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const { url: file_url } = await UploadFile({ file });
      setFormData(prev => ({ ...prev, profile_picture: file_url }));
      await api.patch('/api/users/me', { avatar_url: file_url });
      toast.success('Profile picture updated');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const accessLevelLabels = {
    webmaster: 'Webmaster',
    admin: 'Administrator',
    user: 'User',
  };

  const accessLevelColors = {
    webmaster: 'from-[#cb6ce6] to-[#38b6ff]',
    admin: 'from-[#3572b9] to-[#38b6ff]',
    user: 'from-[#38b6ff] to-[#00e7ff]',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#38b6ff] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>
          My Profile
        </h1>
        <p className="text-gray-400 mt-1">Manage your personal information</p>
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-[#3572b9] via-[#38b6ff] to-[#cb6ce6] relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-20" />
        </div>

        {/* Avatar & Basic Info */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12 mb-6">
            <div className="relative">
              {formData.profile_picture ? (
                <img 
                  src={formData.profile_picture} 
                  alt="Profile"
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-[#0a0a0a]"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#3572b9] to-[#cb6ce6] 
                  flex items-center justify-center text-white text-3xl font-bold border-4 border-[#0a0a0a]">
                  {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#38b6ff] 
                  flex items-center justify-center text-white hover:bg-[#3572b9] transition-colors
                  disabled:opacity-50"
              >
                {isUploadingPhoto ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Camera size={16} />
                )}
              </button>
            </div>
            
            <div className="flex-1 pb-2">
              <h2 className="text-xl font-bold text-white z-10 relative">{user?.full_name || 'User'}</h2>
              <p className="text-gray-400">{user?.email}</p>
            </div>

            <div className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${accessLevelColors[user?.access_level || 'user']} text-white text-sm font-medium`}>
              <Shield size={14} className="inline-block mr-1.5 -mt-0.5" />
              {accessLevelLabels[user?.access_level || 'user']}
            </div>
          </div>

          {/* Company Info */}
          {company && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3572b9]/20 to-[#cb6ce6]/20 
                flex items-center justify-center">
                <Building2 size={24} className="text-[#38b6ff]" />
              </div>
              <div>
                <p className="font-semibold text-white">{company.name}</p>
                <p className="text-gray-400 text-sm capitalize">{company.subscription_tier || 'Basic'} Plan</p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Full Name</Label>
              <div className="relative mt-1.5">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400">Email</Label>
              <div className="relative mt-1.5">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={user?.email || ''}
                  disabled
                  className="pl-10 bg-black/30 border-white/10 text-gray-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <Label className="text-gray-400">Phone Number</Label>
              <div className="relative mt-1.5">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400">Timezone</Label>
              <div className="relative mt-1.5">
                <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={formData.timezone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  className="pl-10 bg-black/30 border-white/10 text-white"
                  placeholder="UTC"
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="mt-6 bg-gradient-to-r from-[#3572b9] to-[#38b6ff] gap-2"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-gray-400 text-sm">Member Since</p>
            <p className="text-white font-medium mt-1">
              {user?.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5">
            <p className="text-gray-400 text-sm">Account Type</p>
            <p className="text-white font-medium mt-1 capitalize">{user?.role || 'User'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}