import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UploadCloud, FileText, CheckCircle2, Camera } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import { resolveMediaUrl } from '../utils/urlHelpers';
import { toast } from 'sonner';
import { showFriendlyError } from '../utils/errorHandler';
import { useTheme } from '../context/ThemeContext';

const DriverRegisterPage = () => {
  const navigate = useNavigate();
  const { user, driverProfile, registerDriver, api, fetchUser } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  
  const [docs, setDocs] = useState({
    profile_photo: null,
    license: null,
    registration: null
  });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(user?.avatar_url || driverProfile?.avatar_url || null);
  const [previewError, setPreviewError] = useState(false);
  
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_type: driverProfile?.vehicle_type || 'car',
    plate_number: driverProfile?.plate_number && !driverProfile.plate_number.startsWith('MR-') ? driverProfile.plate_number : '',
    vehicle_model: driverProfile?.vehicle_model && driverProfile.vehicle_model !== 'Campus Shuttle' ? driverProfile.vehicle_model : '',
    vehicle_color: driverProfile?.vehicle_color && driverProfile.vehicle_color !== 'White' ? driverProfile.vehicle_color : '',
    vehicle_capacity: driverProfile?.vehicle_capacity || 4
  });

  useEffect(() => {
    if (driverProfile?.is_approved) {
      navigate('/driver', { replace: true });
      return;
    }
    if (driverProfile) {
      setFormData({
        vehicle_type: driverProfile.vehicle_type || 'car',
        plate_number: driverProfile.plate_number && !driverProfile.plate_number.startsWith('MR-') ? driverProfile.plate_number : '',
        vehicle_model: driverProfile.vehicle_model && driverProfile.vehicle_model !== 'Campus Shuttle' ? driverProfile.vehicle_model : '',
        vehicle_color: driverProfile.vehicle_color && driverProfile.vehicle_color !== 'White' ? driverProfile.vehicle_color : '',
        vehicle_capacity: driverProfile.vehicle_capacity || 4
      });
      if (driverProfile.avatar_url || user?.avatar_url) {
        setProfilePhotoPreview(driverProfile.avatar_url || user?.avatar_url);
      }
    }
  }, [driverProfile, user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocs(prev => ({ ...prev, [e.target.name]: file }));
      if (e.target.name === 'profile_photo') {
        setPreviewError(false);
        setProfilePhotoPreview(URL.createObjectURL(file));
      }
    }
  };

  const uploadFile = async (file) => {
    const compressed = await compressImage(file, 1200, 0.8);
    const formData = new FormData();
    formData.append("file", compressed);
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!docs.profile_photo && !profilePhotoPreview) {
      toast.error('Please upload your driver profile photo');
      return;
    }

    setLoading(true);
    setUploadingDocs(true);

    try {
      // 1. Upload the documents & profile photo
      let profilePhotoUrl = profilePhotoPreview && !docs.profile_photo ? profilePhotoPreview : "";
      let licenseUrl = driverProfile?.verification_docs?.license || "";
      let registrationUrl = driverProfile?.verification_docs?.registration || "";
      
      if (docs.profile_photo) {
        profilePhotoUrl = await uploadFile(docs.profile_photo);
      }
      if (docs.license) {
        licenseUrl = await uploadFile(docs.license);
      }
      if (docs.registration) {
        registrationUrl = await uploadFile(docs.registration);
      }
      
      // 2. Add URLs & capacity to the form payload
      const payload = {
        ...formData,
        vehicle_capacity: parseInt(formData.vehicle_capacity) || 4,
        avatar_url: profilePhotoUrl,
        verification_docs: {
          profile_photo: profilePhotoUrl,
          license: licenseUrl,
          registration: registrationUrl
        }
      };

      await registerDriver(payload);
      window.dispatchEvent(new Event('mulu-refresh-user'));
      if (fetchUser) await fetchUser();
      
      setUploadingDocs(false);
      toast.success('Vehicle details submitted successfully!');
      setTimeout(() => {
        navigate('/driver', { replace: true });
      }, 500);
    } catch (error) {
      console.error('Registration error:', error);
      showFriendlyError(error, 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
      setUploadingDocs(false);
    }
  };

  const handleBack = () => {
    if (user?.role === 'driver') {
      navigate('/profile');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden w-full max-w-full">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/5 rounded-full blur-[100px]" />
      </div>

      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors z-20"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <div className="relative z-10 w-full max-w-md mx-auto my-auto">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <img 
            src={theme === 'light' ? '/assets/images/jride_text_black.png' : '/assets/images/jride_text_white.png'} 
            alt="JRide" 
            className="h-10 w-auto object-contain" 
          />
        </div>

        <GlassCard className="p-8" data-testid="driver-register-card">
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
              Complete Driver Setup
            </h1>
            <p className="text-muted-foreground/50 text-sm">
              Add your vehicle details to start earning
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mandatory Driver Profile Photo Upload */}
            <div className="flex flex-col items-center justify-center pt-2 pb-2">
              <label className="block text-xs text-muted-foreground/80 font-semibold uppercase tracking-wider mb-2">Driver Profile Photo *</label>
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  name="profile_photo"
                  id="reg_profile_photo_upload"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="reg_profile_photo_upload" className="block relative cursor-pointer">
                  <div className={`w-24 h-24 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all ${profilePhotoPreview && !previewError ? 'border-gold shadow-none' : 'border-dashed border-zinc-700 bg-zinc-900 hover:border-gold'}`}>
                    {profilePhotoPreview && !previewError ? (
                      <img 
                        src={resolveMediaUrl(profilePhotoPreview)} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={() => setPreviewError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-zinc-500 hover:text-gold transition-colors">
                        <Camera className="w-7 h-7" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gold text-black flex items-center justify-center shadow-md">
                    <Camera className="w-4 h-4" />
                  </div>
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Clear facial photo for passenger verification</p>
            </div>

            {/* Mandatory Passenger Capacity Selector */}
            <div>
              <label className="block text-sm text-muted-foreground/60 mb-2">Passenger Capacity *</label>
              <div className="grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicle_capacity: cap })}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all ${formData.vehicle_capacity === cap
                      ? 'bg-gold text-black shadow-md'
                      : 'bg-muted text-muted-foreground/60 hover:bg-muted/10'
                    }`}
                  >
                    {cap} {cap === 1 ? 'Seat' : 'Seats'}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Model */}
            <div>
              <label className="block text-sm text-muted-foreground/60 mb-2">Vehicle Model</label>
              <GlassInput
                type="text"
                name="vehicle_model"
                placeholder="e.g. Toyota Corolla"
                value={formData.vehicle_model}
                onChange={handleChange}
                required
                data-testid="vehicle-model-input"
              />
            </div>

            {/* Vehicle Color */}
            <div>
              <label className="block text-sm text-muted-foreground/60 mb-2">Vehicle Color</label>
              <GlassInput
                type="text"
                name="vehicle_color"
                placeholder="e.g. White"
                value={formData.vehicle_color}
                onChange={handleChange}
                required
                data-testid="vehicle-color-input"
              />
            </div>

            {/* Plate Number */}
            <div>
              <label className="block text-sm text-muted-foreground/60 mb-2">Plate Number</label>
              <GlassInput
                type="text"
                name="plate_number"
                placeholder="e.g. ABC 1234"
                value={formData.plate_number}
                onChange={handleChange}
                required
                className="uppercase"
                data-testid="plate-number-input"
              />
            </div>

            {/* KYC Documents */}
            <div className="pt-2 border-t border-border mt-4 mb-2">
              <label className="block text-sm text-foreground font-medium mb-3">Verification Documents</label>
              <div className="space-y-3">
                
                {/* Driver's License */}
                <div className="relative">
                  <input
                    type="file"
                    name="license"
                    id="license_upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="license_upload"
                    className={`flex items-center justify-between p-3 rounded-xl border border-dashed cursor-pointer transition-colors ${docs.license ? 'bg-gold/10 border-gold/50 text-gold' : 'bg-muted border-white/10 text-muted-foreground hover:bg-muted/80'}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" />
                      <span className="text-sm font-medium">{docs.license ? docs.license.name : "Upload Driver's License"}</span>
                    </div>
                    {docs.license ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                  </label>
                </div>

                {/* Vehicle Registration */}
                <div className="relative">
                  <input
                    type="file"
                    name="registration"
                    id="registration_upload"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="registration_upload"
                    className={`flex items-center justify-between p-3 rounded-xl border border-dashed cursor-pointer transition-colors ${docs.registration ? 'bg-gold/10 border-gold/50 text-gold' : 'bg-muted border-white/10 text-muted-foreground hover:bg-muted/80'}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" />
                      <span className="text-sm font-medium">{docs.registration ? docs.registration.name : "Upload Vehicle Registration"}</span>
                    </div>
                    {docs.registration ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                  </label>
                </div>
                
              </div>
            </div>

            <div className="pt-4">
              <GoldButton
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="submit-btn"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{uploadingDocs ? "Uploading Documents..." : "Saving Profile..."}</span>
                  </div>
                ) : (
                  'Complete Registration'
                )}
              </GoldButton>
            </div>
          </form>

          <p className="text-center text-muted-foreground/40 text-xs mt-6">
            Your account will be reviewed by our team before you can start accepting rides.
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

export default DriverRegisterPage;
