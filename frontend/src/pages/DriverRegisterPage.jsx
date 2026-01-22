import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, ArrowLeft, Loader2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const DriverRegisterPage = () => {
  const navigate = useNavigate();
  const { registerDriver } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicle_type: 'car',
    plate_number: '',
    vehicle_model: '',
    vehicle_color: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await registerDriver(formData);
      toast.success('Driver profile created! Pending approval.');
      navigate('/driver');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px]" />
      </div>

      {/* Back Button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors z-20"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-gold">
            <Car className="w-7 h-7 text-black" />
          </div>
        </div>

        <GlassCard className="p-8" data-testid="driver-register-card">
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl font-bold text-white mb-2">
              Complete Driver Setup
            </h1>
            <p className="text-white/50 text-sm">
              Add your vehicle details to start earning
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vehicle Type */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Vehicle Type</label>
              <div className="grid grid-cols-3 gap-2">
                {['car', 'motorcycle', 'bicycle'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicle_type: type })}
                    className={`p-3 rounded-xl text-sm capitalize transition-all ${
                      formData.vehicle_type === type
                        ? 'bg-gold text-black font-medium'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                    data-testid={`vehicle-type-${type}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Model */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Vehicle Model</label>
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
              <label className="block text-sm text-white/60 mb-2">Vehicle Color</label>
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
              <label className="block text-sm text-white/60 mb-2">Plate Number</label>
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

            <div className="pt-4">
              <GoldButton
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="submit-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Complete Registration'
                )}
              </GoldButton>
            </div>
          </form>

          <p className="text-center text-white/40 text-xs mt-6">
            Your account will be reviewed by our team before you can start accepting rides.
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

export default DriverRegisterPage;
