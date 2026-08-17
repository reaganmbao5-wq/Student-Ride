'use client';

import React, { useEffect, useRef, useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const COLLAPSED_SIZE = 40;

export default function ExpandableSearchBar(props) {
  const {
    expandDirection = 'right',
    placeholder = 'Search...',
    onSearch,
    className = '',
    defaultOpen = false,
    width = 280,
  } = props;

  const [open, setOpen] = useState(defaultOpen);
  const [value, setValue] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const inputPadding = expandDirection === 'right' ? 'pl-11' : 'pl-10';
  const placeholderLeft = expandDirection === 'right' ? 'left-11' : 'left-10';

  useEffect(() => {
    function onDocClick(e) {
      if (
        !containerRef.current?.contains(e.target) &&
        open &&
        value === ''
      ) {
        setOpen(false);
        setValue('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, value]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    } else {
      setValue('');
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(value);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setValue('');
      }

      if (e.key === 'Enter' && open && value.trim()) {
        onSearch?.(value);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, value, onSearch]);

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block', className)}
      style={{ width: COLLAPSED_SIZE, height: COLLAPSED_SIZE }}
    >
      {/* Icon button (always visible, overlays left of bar) */}
      <button
        type='button'
        aria-label={open ? 'Close search' : 'Open search'}
        onClick={() => setOpen((s) => !s)}
        className={cn(
          'absolute inset-0 z-20 grid place-items-center rounded-full border shadow-lg',
          'bg-white text-zinc-700 hover:text-zinc-950 border-zinc-200/90 transition-colors',
          'dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-800'
        )}
      >
        {open ? <X className='w-4 h-4' /> : <Search className='w-4 h-4' />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.form
            key='form'
            onSubmit={handleSubmit}
            className={cn(
              'absolute top-0 h-10 rounded-full border shadow-xl overflow-hidden flex items-center',
              'bg-white text-zinc-900 border-zinc-200/90',
              'dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800',
              expandDirection === 'left' ? 'right-0' : 'left-0'
            )}
            initial={{ width: COLLAPSED_SIZE, opacity: 0.98 }}
            animate={{ width: width, opacity: 1 }}
            exit={{
              width: COLLAPSED_SIZE,
              opacity: 0,
              transition: { type: 'spring', stiffness: 260, damping: 26 },
            }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            {/* Absolutely positioned left search icon */}
            <span className='absolute left-3 z-10 text-zinc-400 dark:text-zinc-400'>
              <Search className='w-4 h-4' />
            </span>

            <div className='relative flex-1 min-w-0 flex items-center'>
              <input
                ref={inputRef}
                type='text'
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className={cn(
                  'w-full bg-transparent text-sm border-none outline-none focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 shadow-none placeholder-transparent whitespace-nowrap overflow-x-auto text-zinc-900 dark:text-zinc-100',
                  inputPadding
                )}
                style={{ outline: 'none', boxShadow: 'none', border: 'none' }}
              />

              <AnimatePresence>
                {open && !value && (
                  <motion.span
                    key='ph'
                    className={cn(
                      'pointer-events-none absolute top-1/2 -translate-y-1/2 w-full truncate text-muted-foreground/80 text-sm select-none text-left',
                      placeholderLeft
                    )}
                    initial={{ opacity: 1, x: 0 }}
                    animate={{ opacity: 0.9, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {placeholder}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.button
                  key='go'
                  type='submit'
                  className='h-10 w-10 grid place-items-center text-muted-foreground hover:text-foreground'
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  aria-label='Search'
                >
                  <Search className='w-4 h-4' />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
