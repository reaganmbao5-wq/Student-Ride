import React from 'react';
import { cn } from '../../lib/utils';

export const GlassCard = React.forwardRef(({ className, children, hover = true, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-glass transition-all duration-300",
        hover && "hover:border-gold/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

GlassCard.displayName = "GlassCard";

export const GlassInput = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full bg-black/30 border border-white/10 rounded-xl h-12 px-4 text-white placeholder:text-white/30",
        "focus:border-gold focus:ring-1 focus:ring-gold focus:outline-none transition-all",
        "backdrop-blur-md",
        className
      )}
      {...props}
    />
  );
});

GlassInput.displayName = "GlassInput";

export const GoldButton = React.forwardRef(({ className, children, variant = "primary", size = "default", ...props }, ref) => {
  const variants = {
    primary: "bg-gold text-black hover:bg-gold-dark shadow-gold",
    secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/5 backdrop-blur-md",
    ghost: "text-gold hover:bg-gold/10"
  };

  const sizes = {
    default: "px-8 py-3 text-base",
    sm: "px-4 py-2 text-sm",
    lg: "px-10 py-4 text-lg",
    icon: "p-3"
  };

  return (
    <button
      ref={ref}
      className={cn(
        "rounded-full font-semibold transition-all duration-300",
        "hover:scale-105 active:scale-95",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

GoldButton.displayName = "GoldButton";

export const StatusBadge = ({ status }) => {
  const statusConfig = {
    requested: { label: 'Requested', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    accepted: { label: 'Accepted', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    driver_arrived: { label: 'Driver Arrived', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    ongoing: { label: 'Ongoing', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    completed: { label: 'Completed', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30' }
  };

  const config = statusConfig[status] || statusConfig.requested;

  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border",
      config.className
    )}>
      {config.label}
    </span>
  );
};

export const RatingStars = ({ rating, size = 'sm', interactive = false, onChange }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? 'button' : undefined}
          onClick={() => interactive && onChange && onChange(star)}
          className={cn(
            sizes[size],
            interactive && 'cursor-pointer hover:scale-110 transition-transform',
            !interactive && 'cursor-default'
          )}
          disabled={!interactive}
        >
          <svg
            viewBox="0 0 24 24"
            fill={star <= rating ? '#D4AF37' : 'none'}
            stroke={star <= rating ? '#D4AF37' : '#4A4A4A'}
            strokeWidth="2"
            className="w-full h-full"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
};

export const LoadingSpinner = ({ size = 'md', className }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={cn("relative", sizes[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-white/10" />
      <div className="absolute inset-0 rounded-full border-2 border-gold border-t-transparent animate-spin" />
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-white/40" />
        </div>
      )}
      <h3 className="text-lg font-heading font-medium text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-white/60 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
};

export default GlassCard;
