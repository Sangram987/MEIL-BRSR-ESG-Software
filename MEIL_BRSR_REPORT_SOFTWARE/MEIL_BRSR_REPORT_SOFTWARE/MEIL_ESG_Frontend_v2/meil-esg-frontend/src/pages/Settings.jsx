import React, { useState, useRef } from 'react';
import { useApp } from '../store/AppStore';
import { 
  User, Bell, Shield, Key, Camera, CheckCircle2, 
  Smartphone, Mail, AlertTriangle, ShieldCheck, Clock 
} from 'lucide-react';

export default function Settings() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState('profile');
  const [toast, setToast] = useState(null);
  
  // Profile State
  const [profileImage, setProfileImage] = useState(null);
  const [profileData, setProfileData] = useState({
    firstName: user.name.split(' ')[0],
    lastName: user.name.split(' ').slice(1).join(' '),
    email: user.email,
    phone: '+91 98765 43210',
    timezone: 'Asia/Kolkata (IST)',
  });

  // Reference for the hidden file input
  const fileInputRef = useRef(null);

  // --- Handlers ---
  const handleInputChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Use FileReader to preview the image instantly on the frontend
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSave = (e) => {
    e.preventDefault();
    // Simulate API call to save settings
    setToast('Settings successfully updated.');
    setTimeout(() => setToast(null), 3000);
  };

  // Reusable Premium Toggle Switch Component
  const PremiumToggle = ({ label, description, defaultChecked }) => (
    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 max-w-sm">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="absolute top-0 right-0 animate-in slide-in-from-top-4 fade-in duration-300 z-50">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg shadow-sm flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span className="text-sm font-bold">{toast}</span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your MEIL portal profile, notifications, and security preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Settings Navigation Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { id: 'profile', icon: User, label: 'My Profile' },
              { id: 'notifications', icon: Bell, label: 'Alerts & Notifications' },
              { id: 'security', icon: Shield, label: 'Security & Access' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                }`}
              >
                <tab.icon size={18} className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 min-h-[500px]">
          
          {/* --- TAB 1: PROFILE --- */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSave} className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-6">Profile Information</h2>
                
                {/* Premium Interactive Avatar */}
                <div className="flex items-center gap-6 mb-8">
                  <div 
                    onClick={triggerFileInput}
                    className="relative group cursor-pointer h-24 w-24 rounded-full border-2 border-slate-200 overflow-hidden bg-slate-50 shadow-sm"
                  >
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-3xl font-black text-slate-300">
                        {profileData.firstName[0]}{profileData.lastName[0]}
                      </div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-slate-900/60 hidden group-hover:flex flex-col items-center justify-center transition-all">
                      <Camera size={24} className="text-white mb-1" />
                      <span className="text-[10px] text-white font-bold tracking-wider">CHANGE</span>
                    </div>
                  </div>
                  
                  {/* Hidden File Input */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  <div>
                    <h3 className="text-base font-bold text-slate-900">{profileData.firstName} {profileData.lastName}</h3>
                    <p className="text-sm text-slate-500 mb-3">Group ESG Controller • Admin</p>
                    <button 
                      type="button" 
                      onClick={triggerFileInput}
                      className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                    >
                      Upload New Photo
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">First Name</label>
                    <input type="text" name="firstName" value={profileData.firstName} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Last Name</label>
                    <input type="text" name="lastName" value={profileData.lastName} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Email Address</label>
                    <input type="email" name="email" value={profileData.email} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Phone Number</label>
                    <input type="text" name="phone" value={profileData.phone} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Timezone Preference</label>
                    <select name="timezone" value={profileData.timezone} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition">
                      <option>Asia/Kolkata (IST)</option>
                      <option>America/New_York (EST)</option>
                      <option>Europe/London (GMT)</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* --- TAB 2: NOTIFICATIONS --- */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-6">Alerts & Notifications</h2>
              
              <div className="space-y-4">
                <PremiumToggle 
                  label="Email Summaries (Weekly)" 
                  description="Receive a consolidated report of subsidiary data submissions and compliance status." 
                  defaultChecked={true} 
                />
                <PremiumToggle 
                  label="Anomaly Detection Alerts" 
                  description="Immediate push notifications if the AI engine detects unusual data spikes at any project site." 
                  defaultChecked={true} 
                />
                <PremiumToggle 
                  label="Approval Reminders" 
                  description="Automated nudges when BU Verifications sit pending for more than 48 hours." 
                  defaultChecked={false} 
                />
                <PremiumToggle 
                  label="Statutory Deadline Warnings" 
                  description="Critical alerts as SEBI BRSR reporting deadlines approach." 
                  defaultChecked={true} 
                />
              </div>

              <div className="pt-8 flex justify-end">
                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                  Update Preferences
                </button>
              </div>
            </div>
          )}

          {/* --- TAB 3: SECURITY --- */}
          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-6">Security & Access</h2>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 flex items-start gap-4">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Two-Factor Authentication (2FA) is Active</h3>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                      Your account is protected with an authenticator app. You will be prompted for a code when logging in from unrecognized devices.
                    </p>
                    <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm">
                      Manage 2FA Settings
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-800 mb-4">Change Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Current Password</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="hidden md:block"></div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Confirm New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-t border-slate-100 pt-6">Recent Active Sessions</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <Smartphone size={18} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">MacBook Pro - Chrome</p>
                        <p className="text-xs text-slate-500">Hyderabad, India (IP: 192.168.1.1)</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">Current Session</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50">
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">iPhone 14 - Safari</p>
                        <p className="text-xs text-slate-500">Mumbai, India • 2 days ago</p>
                      </div>
                    </div>
                    <button className="text-xs font-bold text-rose-600 hover:text-rose-800">Revoke</button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                  Update Security
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}