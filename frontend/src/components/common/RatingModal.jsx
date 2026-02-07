import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { GlassCard, GoldButton } from './GlassComponents';
import { toast } from 'sonner';

export const RatingModal = ({ isOpen, onClose, onSubmit, driverName, rideId }) => {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({ rating, review });
            onClose();
        } catch (error) {
            console.error('Error submitting rating:', error);
            toast.error('Failed to submit rating');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <GlassCard className="w-full max-w-md relative" hover={false}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-6">
                    <h2 className="font-heading text-2xl font-bold text-white mb-2">Rate Your Trip</h2>
                    <p className="text-white/60">How was your ride with {driverName}?</p>
                </div>

                {/* Star Rating */}
                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="p-1 transition-transform hover:scale-110 focus:outline-none"
                        >
                            <Star
                                className={`w-10 h-10 ${star <= rating
                                    ? 'text-gold fill-gold'
                                    : 'text-white/20 fill-none'
                                    }`}
                            />
                        </button>
                    ))}
                </div>

                {/* Review Text */}
                <div className="mb-6">
                    <textarea
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        placeholder="Share your experience (optional)..."
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 search-input focus:border-gold/50 focus:ring-0 resize-none"
                    />
                </div>

                <GoldButton
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={submitting || rating === 0}
                >
                    {submitting ? 'Submitting...' : 'Submit Rating'}
                </GoldButton>
            </GlassCard>
        </div>
    );
};
