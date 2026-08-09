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
            "group toast group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-zinc-800 rounded-full px-5 py-3 text-sm font-semibold tracking-wide flex items-center gap-3 shadow-none",
          description: "group-[.toast]:text-zinc-400 text-xs",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-black font-bold rounded-xl text-xs",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300 rounded-xl text-xs",
          success: "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:border-emerald-500/40 shadow-none",
          error: "group-[.toast]:bg-black group-[.toast]:text-red-400 group-[.toast]:border-red-500/40 shadow-none",
          info: "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:border-zinc-800 shadow-none",
        },
      }}
      icons={{
        success: <CheckCircle2 className="w-5 h-5 text-white bg-emerald-500 rounded-full p-0.5 shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
        info: <Info className="w-5 h-5 text-gold shrink-0" />,
      }}
      {...props}
    />
  );
}

export { Toaster, toast }
