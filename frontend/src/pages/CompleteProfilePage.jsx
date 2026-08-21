import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { Phone, Lock, User, Mail, CheckCircle, GraduationCap } from 'lucide-react';
import { Car } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getOnlineWebUrl, openExternalUrl, getBackendUrl } from '../utils/urlHelpers';
import { showFriendlyError } from '../utils/errorHandler';

const BACKEND_URL = getBackendUrl();

const Checkbox = React.forwardRef(({ className, checked, onChange, ...props }, ref) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={() => onChange && onChange(!checked)}
    className={`peer size-4 shrink-0 rounded border border-zinc-700 shadow-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'border-gold bg-gold text-zinc-950' : 'bg-zinc-900 text-transparent hover:border-gold/50'
    } ${className}`}
    {...props}
  >
    <span className="flex items-center justify-center text-current">
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.53547 0.62293C8.88226 0.849446 8.97976 1.3142 8.75325 1.66099L4.5083 8.1599C4.38833 8.34356 4.19397 8.4655 3.9764 8.49358C3.75883 8.52167 3.53987 8.45309 3.3772 8.30591L0.616113 5.80777C0.308959 5.52987 0.285246 5.05559 0.563148 4.74844C0.84105 4.44128 1.31533 4.41757 1.62249 4.69547L3.73256 6.60459L7.49741 0.840706C7.72393 0.493916 8.18868 0.396414 8.53547 0.62293Z"
        />
      </svg>
    </span>
  </button>
));
Checkbox.displayName = 'Checkbox';

export default function CompleteProfilePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state || {};

    const [name] = useState(state.name || '');
    const [email] = useState(state.email || '');
    const [phone, setPhone] = useState(state.phone || '');
    const [isDriver, setIsDriver] = useState(false);
    const [passengerRole, setPassengerRole] = useState('student');
    const [yearOfStudy, setYearOfStudy] = useState('1');
    const [programType, setProgramType] = useState('standard');
    const [loading, setLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const token = state.token;

    // Redirect if someone lands here without Google state
    useEffect(() => {
        if (!token || !email) {
            navigate('/auth?mode=login');
        }
    }, [token, email, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!phone.trim()) {
            toast.error('Please enter your phone number');
            return;
        }
        if (!agreedToTerms) {
            toast.error('You must agree to the Terms of Service and Privacy Policy');
            return;
        }

        setLoading(true);
        try {
            // Update the user profile with phone, role, year_of_study, and preferences
            const updateBody = { 
                phone,
                role: isDriver ? 'student' : passengerRole,
                ...(state.gender ? { gender: state.gender } : {})
            };
            if (!isDriver && passengerRole === 'student') {
                updateBody.year_of_study = parseInt(yearOfStudy);
                updateBody.program_type = programType;
            }
            if (state.themeMode) localStorage.setItem('mulu_theme_mode', state.themeMode);
            if (state.accentColor) localStorage.setItem('mulu_accent_color', state.accentColor);
            if (state.mapThemeMode) localStorage.setItem('map_theme_mode', state.mapThemeMode);

            // DO NOT pre-emptively strictly set role to driver here.
            // The DriverRegisterPage requires the user to be a 'student' to fill out the form,
            // which THEN upgrades their role to 'driver'.

            const res = await fetch(`${BACKEND_URL}/api/users/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updateBody),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Failed to update profile');
            }

            toast.success('Welcome to J Ride! 🎉');

            // Reload into the dashboard so AuthContext picks up the stored token
            window.location.href = isDriver ? '/driver/register' : '/dashboard';
        } catch (err) {
            showFriendlyError(err, 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 py-8 relative overflow-x-hidden w-full max-w-full transition-colors duration-300">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/5 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-md mx-auto my-auto">
                {/* Logo */}
                <div className="flex flex-col items-center gap-3 mb-6">
                    <img src="/assets/images/jride_text_white.png" alt="JRide" className="h-10 w-auto object-contain mb-1" />
                    <div className="text-center">
                        <h1 className="font-heading text-2xl font-bold text-foreground">Almost there!</h1>
                        <p className="text-muted-foreground text-sm mt-1">Just a few more details to get you riding</p>
                    </div>
                </div>

                <GlassCard className="p-8">
                    {/* Progress indicator */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-black" />
                            </div>
                            <span className="text-xs text-muted-foreground">Google</span>
                        </div>
                        <div className="flex-1 h-0.5 bg-gold/40 rounded" />
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center">
                                <span className="text-xs font-bold text-black">2</span>
                            </div>
                            <span className="text-xs text-gold font-medium">Details</span>
                        </div>
                        <div className="flex-1 h-0.5 bg-border rounded" />
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">3</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Ride</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name — locked */}
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold" />
                            <GlassInput
                                type="text"
                                value={name}
                                readOnly
                                className="pl-12 pr-12 opacity-75 cursor-not-allowed"
                                placeholder="Name"
                            />
                            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>

                        {/* Email — locked */}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold" />
                            <GlassInput
                                type="email"
                                value={email}
                                readOnly
                                className="pl-12 pr-12 opacity-75 cursor-not-allowed"
                                placeholder="Email"
                            />
                            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>

                        <p className="text-xs text-muted-foreground text-center -mt-1">
                            ✓ Verified by Google — these fields are locked
                        </p>

                        {/* Divider */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-card px-3 text-xs text-muted-foreground">Your details</span>
                            </div>
                        </div>

                        {/* Phone — editable */}
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <GlassInput
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Phone Number (e.g. +260 97 000 0000)"
                                className="pl-12"
                                required
                                autoFocus
                            />
                        </div>

                        {/* Passenger Role & Year of Study Selector */}
                        {!isDriver && (
                            <div className="space-y-3 p-3.5 bg-muted/60 rounded-xl border border-border/50">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPassengerRole('student')}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                passengerRole === 'student'
                                                    ? 'bg-gold/15 border-gold text-gold shadow-none'
                                                    : 'bg-card border-border text-muted-foreground hover:border-border/80'
                                            }`}
                                        >
                                            <User className="w-3.5 h-3.5" />
                                            <span>Student</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPassengerRole('lecturer')}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                passengerRole === 'lecturer'
                                                    ? 'bg-gold/15 border-gold text-gold shadow-none'
                                                    : 'bg-card border-border text-muted-foreground hover:border-border/80'
                                            }`}
                                        >
                                            <GraduationCap className="w-3.5 h-3.5" />
                                            <span>Lecturer</span>
                                        </button>
                                    </div>
                                </div>

                                {passengerRole === 'student' && (
                                    <div className="space-y-3 pt-1">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Year of Study</label>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {['1', '2', '3', '4', '5'].map((yr) => (
                                                    <button
                                                        key={yr}
                                                        type="button"
                                                        onClick={() => setYearOfStudy(yr)}
                                                        className={`py-2 rounded-xl text-xs font-extrabold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                                                            String(yearOfStudy) === yr
                                                                ? 'bg-gold border-gold text-white font-bold shadow-none scale-[1.02]'
                                                                : 'bg-card border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                                                        }`}
                                                    >
                                                        <span>{yr === '1' ? '1st' : yr === '2' ? '2nd' : yr === '3' ? '3rd' : `${yr}th`}</span>
                                                        <span className="text-[9px] font-semibold opacity-75">Year</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Academic Program</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setProgramType('standard')}
                                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                                                        programType === 'standard'
                                                            ? 'bg-gold/15 border-gold text-gold shadow-none'
                                                            : 'bg-card border-border text-muted-foreground hover:border-border/80'
                                                    }`}
                                                >
                                                    <span>Standard</span>
                                                    <span className="text-[10px] font-medium opacity-80">(4-Year Degree)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setProgramType('engineering')}
                                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                                                        programType === 'engineering'
                                                            ? 'bg-gold/15 border-gold text-gold shadow-none'
                                                            : 'bg-card border-border text-muted-foreground hover:border-border/80'
                                                    }`}
                                                >
                                                    <span>Engineering</span>
                                                    <span className="text-[10px] font-medium opacity-80">(5-Year Degree)</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Driver toggle */}
                        <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                            <div className="flex items-center gap-3">
                                <Car weight="duotone" className="w-5 h-5 text-gold" />
                                <div>
                                    <p className="text-foreground text-sm font-medium">Join as a Driver</p>
                                    <p className="text-muted-foreground text-xs">Earn money by driving students</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDriver(!isDriver)}
                                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${isDriver ? 'bg-gold' : 'bg-muted-foreground/30'}`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${isDriver ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {isDriver && (
                            <div className="p-3 bg-gold/10 border border-gold/30 rounded-xl">
                                <p className="text-gold text-xs text-center">
                                    🚗 After setup you'll complete your driver registration with vehicle details
                                </p>
                            </div>
                        )}

                        <div className="flex items-start gap-2.5 pt-2 pb-1">
                          <Checkbox
                            id="google-terms-checkbox"
                            checked={agreedToTerms}
                            onChange={setAgreedToTerms}
                            className="mt-0.5"
                          />
                          <label htmlFor="google-terms-checkbox" className="text-xs text-muted-foreground select-none cursor-pointer leading-relaxed">
                            I agree to the{' '}
                            <a
                              href={getOnlineWebUrl('/terms')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gold underline hover:text-gold/80 transition-colors font-semibold"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openExternalUrl('/terms');
                              }}
                            >
                              terms of service
                            </a>
                            {' '}and{' '}
                            <a
                              href={getOnlineWebUrl('/privacy')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gold underline hover:text-gold/80 transition-colors font-semibold"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openExternalUrl('/privacy');
                              }}
                            >
                              privacy policy
                            </a>
                          </label>
                        </div>

                        <GoldButton type="submit" className="w-full mt-4" disabled={loading || !agreedToTerms}>
                            {loading ? (
                                <LoadingSpinner size="sm" className="mx-auto" />
                            ) : (
                                isDriver ? 'Continue to Driver Setup →' : 'Start Riding →'
                            )}
                        </GoldButton>
                    </form>
                </GlassCard>
            </div>
        </div>
    );
}
