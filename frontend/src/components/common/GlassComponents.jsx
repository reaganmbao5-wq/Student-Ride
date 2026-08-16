import React from 'react';
import { cn } from '../../lib/utils';
import { haptics } from '../../utils/haptics';

export const GlassCard = React.forwardRef(({ className, children, hover = true, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-card text-card-foreground border border-border rounded-3xl p-6 backdrop-blur-xl shadow-glass transition-all duration-300",
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
        "w-full bg-muted/50 dark:bg-black/30 border border-border rounded-xl h-12 px-4 text-foreground placeholder:text-muted-foreground",
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
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border backdrop-blur-md",
    ghost: "text-gold hover:bg-gold/10"
  };

  const sizes = {
    default: "px-8 py-3 text-base",
    sm: "px-4 py-2 text-sm",
    lg: "px-10 py-4 text-lg",
    icon: "p-3"
  };

  const { onClick, ...otherProps } = props;

  return (
    <button
      ref={ref}
      onClick={(e) => {
        haptics.primaryButton();
        if (onClick) onClick(e);
      }}
      className={cn(
        "rounded-full font-semibold transition-all duration-300",
        "hover:scale-105 active:scale-95",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...otherProps}
    >
      {children}
    </button>
  );
});

GoldButton.displayName = "GoldButton";

export const StatusBadge = ({ status }) => {
  const statusConfig = {
    requested: { label: 'Requested', className: 'text-amber-600 dark:text-amber-400 font-bold' },
    accepted: { label: 'Accepted', className: 'text-blue-600 dark:text-blue-400 font-bold' },
    driver_accepted: { label: 'Accepted', className: 'text-blue-600 dark:text-blue-400 font-bold' },
    driver_en_route_to_pickup: { label: 'En Route', className: 'text-blue-600 dark:text-blue-400 font-bold' },
    driver_arrived: { label: 'Driver Arrived', className: 'text-purple-600 dark:text-purple-400 font-bold' },
    passenger_boarding: { label: 'Boarding', className: 'text-purple-600 dark:text-purple-400 font-bold' },
    ride_started: { label: 'Ongoing', className: 'text-emerald-600 dark:text-emerald-400 font-bold' },
    ride_in_progress: { label: 'Ongoing', className: 'text-emerald-600 dark:text-emerald-400 font-bold' },
    ongoing: { label: 'Ongoing', className: 'text-emerald-600 dark:text-emerald-400 font-bold' },
    completed: { label: 'Completed', className: 'text-emerald-600 dark:text-emerald-400 font-bold' },
    ride_completed: { label: 'Completed', className: 'text-emerald-600 dark:text-emerald-400 font-bold' },
    cancelled: { label: 'Cancelled', className: 'text-red-600 dark:text-red-500 font-bold' }
  };

  const config = statusConfig[status] || { 
    label: status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Active', 
    className: 'text-muted-foreground font-bold' 
  };

  return (
    <span className={cn(
      "inline-flex items-center text-xs md:text-sm tracking-tight",
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
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-heading font-medium text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
};

export default GlassCard;
