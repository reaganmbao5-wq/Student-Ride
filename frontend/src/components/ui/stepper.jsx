/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
import { createContext, useContext } from 'react';
import { cn } from '../../lib/utils';

const StepperContext = createContext(undefined);
const StepItemContext = createContext(undefined);

export function useStepper() {
  const ctx = useContext(StepperContext);
  if (!ctx) throw new Error('useStepper must be used within a Stepper');
  return ctx;
}

export function useStepItem() {
  const ctx = useContext(StepItemContext);
  if (!ctx) throw new Error('useStepItem must be used within a StepperItem');
  return ctx;
}

export function Stepper({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = 'vertical',
  className,
  children,
  indicators = {},
  ...props
}) {
  const [activeStep, setActiveStep] = React.useState(defaultValue);
  const [triggerNodes, setTriggerNodes] = React.useState([]);

  const registerTrigger = React.useCallback((node) => {
    setTriggerNodes((prev) => {
      if (node && !prev.includes(node)) {
        return [...prev, node];
      } else if (!node && prev.includes(node)) {
        return prev.filter((n) => n !== node);
      } else {
        return prev;
      }
    });
  }, []);

  const handleSetActiveStep = React.useCallback(
    (step) => {
      if (value === undefined) {
        setActiveStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange],
  );

  const currentStep = value ?? activeStep;

  const focusTrigger = (idx) => {
    if (triggerNodes[idx]) triggerNodes[idx].focus();
  };
  const focusNext = (currentIdx) => focusTrigger((currentIdx + 1) % triggerNodes.length);
  const focusPrev = (currentIdx) => focusTrigger((currentIdx - 1 + triggerNodes.length) % triggerNodes.length);
  const focusFirst = () => focusTrigger(0);
  const focusLast = () => focusTrigger(triggerNodes.length - 1);

  const contextValue = React.useMemo(
    () => ({
      activeStep: currentStep,
      setActiveStep: handleSetActiveStep,
      stepsCount: React.Children.toArray(children).filter(
        (child) => React.isValidElement(child) && child.type?.displayName === 'StepperItem',
      ).length,
      orientation,
      registerTrigger,
      focusNext,
      focusPrev,
      focusFirst,
      focusLast,
      triggerNodes,
      indicators,
    }),
    [currentStep, handleSetActiveStep, children, orientation, registerTrigger, triggerNodes, indicators],
  );

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        role="tablist"
        aria-orientation={orientation}
        data-slot="stepper"
        className={cn('w-full', className)}
        data-orientation={orientation}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

export function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}) {
  const { activeStep } = useStepper();
  const state = completed || step < activeStep ? 'completed' : activeStep === step ? 'active' : 'inactive';
  const isLoading = loading && step === activeStep;

  return (
    <StepItemContext.Provider value={{ step, state, isDisabled: disabled, isLoading }}>
      <div
        data-slot="stepper-item"
        className={cn(
          'group/step flex items-start group-data-[orientation=horizontal]/stepper-nav:flex-row group-data-[orientation=vertical]/stepper-nav:flex-col not-last:flex-1 relative w-full',
          className,
        )}
        data-state={state}
        {...(isLoading ? { 'data-loading': true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}
StepperItem.displayName = 'StepperItem';

export function StepperTrigger({ asChild = false, className, children, tabIndex, ...props }) {
  const { state, isLoading } = useStepItem();
  const stepperCtx = useStepper();
  const { setActiveStep, registerTrigger, triggerNodes, focusNext, focusPrev, focusFirst, focusLast } = stepperCtx;
  const { step, isDisabled } = useStepItem();
  const id = `stepper-tab-${step}`;
  const panelId = `stepper-panel-${step}`;

  const btnRef = React.useRef(null);
  React.useEffect(() => {
    if (btnRef.current) {
      registerTrigger(btnRef.current);
    }
  }, [btnRef.current]);

  const myIdx = React.useMemo(
    () => triggerNodes.findIndex((n) => n === btnRef.current),
    [triggerNodes, btnRef.current],
  );

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        if (myIdx !== -1 && focusNext) focusNext(myIdx);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        if (myIdx !== -1 && focusPrev) focusPrev(myIdx);
        break;
      case 'Home':
        e.preventDefault();
        if (focusFirst) focusFirst();
        break;
      case 'End':
        e.preventDefault();
        if (focusLast) focusLast();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setActiveStep(step);
        break;
      default:
        break;
    }
  };

  if (asChild) {
    return (
      <span data-slot="stepper-trigger" data-state={state} className={className}>
        {children}
      </span>
    );
  }

  return (
    <div
      ref={btnRef}
      role="tab"
      id={id}
      tabIndex={typeof tabIndex === 'number' ? tabIndex : 0}
      aria-controls={panelId}
      data-slot="stepper-trigger"
      data-state={state}
      data-loading={isLoading}
      className={cn(
        'flex items-center gap-3 w-full outline-none disabled:pointer-events-none disabled:opacity-60 text-left',
        className,
      )}
      onClick={() => setActiveStep(step)}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </div>
  );
}

export function StepperIndicator({ children, className }) {
  const { state, isLoading } = useStepItem();
  const { indicators } = useStepper();

  return (
    <div
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        'relative flex items-center overflow-hidden justify-center size-6 shrink-0 rounded-full text-xs font-bold transition-all shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-center w-full h-full">
        {indicators &&
        ((isLoading && indicators.loading) ||
          (state === 'completed' && indicators.completed) ||
          (state === 'active' && indicators.active) ||
          (state === 'inactive' && indicators.inactive))
          ? (isLoading && indicators.loading) ||
            (state === 'completed' && indicators.completed) ||
            (state === 'active' && indicators.active) ||
            (state === 'inactive' && indicators.inactive)
          : children}
      </div>
    </div>
  );
}

export function StepperSeparator({ className }) {
  const { state } = useStepItem();

  return (
    <div
      data-slot="stepper-separator"
      data-state={state}
      className={cn(
        'rounded-full bg-zinc-200 dark:bg-zinc-800 transition-colors',
        className,
      )}
    />
  );
}

export function StepperTitle({ children, className }) {
  const { state } = useStepItem();

  return (
    <h3 data-slot="stepper-title" data-state={state} className={cn('text-[11px] font-bold tracking-wider text-muted-foreground uppercase', className)}>
      {children}
    </h3>
  );
}

export function StepperDescription({ children, className }) {
  const { state } = useStepItem();

  return (
    <div data-slot="stepper-description" data-state={state} className={cn('text-sm font-semibold text-foreground truncate', className)}>
      {children}
    </div>
  );
}

export function StepperNav({ children, className }) {
  const { activeStep, orientation } = useStepper();

  return (
    <nav
      data-slot="stepper-nav"
      data-state={activeStep}
      data-orientation={orientation}
      className={cn(
        'group/stepper-nav inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col w-full gap-2',
        className,
      )}
    >
      {children}
    </nav>
  );
}
