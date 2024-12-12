import { cn } from "@/lib/utils";

export const Spinner = ({ className }: { className?: string }) => {
    return (
        <div
            className={cn(
                "inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em]",
                className
            )}
            role="status"
        >
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                Loading...
            </span>
        </div>
    );
};