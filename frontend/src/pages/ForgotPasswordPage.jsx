import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft, KeySquare } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton } from '../components/common/GlassComponents';
import { toast } from 'sonner';
import { getBackendUrl } from '../utils/urlHelpers';
import { showFriendlyError } from '../utils/errorHandler';

const ForgotPasswordPage = () => {
    const location = useLocation();
    const [email, setEmail] = useState(location.state?.email || '');
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();
    const isEmailLocked = !!location.state?.email;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const endpoint = getBackendUrl('/api/auth/password-reset/request');
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || 'Unable to request password reset. Please try again.');
            }

            setSubmitted(true);
            toast.success('Reset link sent if the account exists!');
        } catch (error) {
            showFriendlyError(error, 'Unable to send reset link. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-gold/20 rounded-full blur-[100px] animate-pulse-slow" />
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow animation-delay-2000" />

            {/* Back Button */}
            <button
                onClick={() => navigate('/')}
                className="absolute top-6 left-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10 
                   border border-white/10 backdrop-blur-md"
            >
                <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>

            <GlassCard className="w-full max-w-md p-8 relative z-10 border-white/10">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gold/20 shadow-inner">
                        <KeySquare className="w-8 h-8 text-gold" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
                        Reset Password
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {submitted
                            ? "Check your email for a reset link."
                            : "Enter your email address to receive a password reset link."}
                    </p>
                </div>

                {submitted ? (
                    <div className="space-y-4 pt-4">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="w-full py-3 rounded-xl text-sm font-medium transition-all bg-white/5 hover:bg-white/10 text-foreground border border-white/10 backdrop-blur-md"
                        >
                            Return to Login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <GlassInput
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`pl-12 ${isEmailLocked ? 'opacity-75 cursor-not-allowed' : ''}`}
                                required
                                readOnly={isEmailLocked}
                            />
                        </div>

                        <GoldButton
                            type="submit"
                            isLoading={isLoading}
                            className="w-full py-3"
                        >
                            Send Reset Link
                        </GoldButton>
                    </form>
                )}
            </GlassCard>
        </div>
    );
};

export default ForgotPasswordPage;
