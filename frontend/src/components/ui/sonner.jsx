import React from "react"
import { Toaster as Sonner, toast } from "sonner"
import { CheckCircle2, AlertCircle, Info } from "lucide-react"

const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-zinc-800 rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide flex items-center gap-2.5 max-w-fit mx-auto shadow-none",
          description: "group-[.toast]:text-zinc-400 text-[11px]",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-black font-bold rounded-lg text-[11px]",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300 rounded-lg text-[11px]",
          success: "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:border-emerald-500/35 shadow-none",
          error: "group-[.toast]:bg-black group-[.toast]:text-red-400 group-[.toast]:border-red-500/35 shadow-none",
          info: "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:border-white/15 shadow-none",
        },
      }}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-white bg-emerald-500 rounded-full p-0.5 shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
        info: <Info className="w-4 h-4 text-gold shrink-0" />,
      }}
      {...props}
    />
  );
}

export { Toaster, toast }
