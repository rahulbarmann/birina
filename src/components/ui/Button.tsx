import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                    "px-4 py-2 disabled:opacity-50 disabled:pointer-events-none",
                    variant === "default" &&
                        "bg-orange-600 text-white hover:bg-orange-700",
                    variant === "outline" &&
                        "border border-orange-200 hover:bg-orange-100",
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";
