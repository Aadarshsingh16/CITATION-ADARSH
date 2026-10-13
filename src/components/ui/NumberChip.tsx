import React from "react";

export type ChipState = "neutral" | "pending" | "verified" | "unverified" | "repaired";

interface NumberChipProps {
  number: number | string;
  state?: ChipState;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const NumberChip: React.FC<NumberChipProps> = ({
  number,
  state = "neutral",
  className = "",
  onClick,
}) => {
  let styleClasses = "bg-[#DBEAFE] text-[#2563EB] border-transparent";

  switch (state) {
    case "verified":
      styleClasses = "bg-[#DCFCE7] text-[#15803D] border-[#86EFAC] border-solid";
      break;
    case "unverified":
      styleClasses = "bg-[#FEF3C7] text-[#B45309] border-[#FCD34D] border-dashed";
      break;
    case "repaired":
      styleClasses = "bg-[#EDE9FE] text-[#6D28D9] border-[#D8B4FE] border-solid";
      break;
    case "pending":
      styleClasses = "bg-[#E5E7EB] text-[#4B5563] border-transparent animate-pulse";
      break;
    case "neutral":
    default:
      styleClasses = "bg-[#DBEAFE] text-[#2563EB] border-transparent";
      break;
  }

  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-[6px] border text-[12px] font-semibold leading-none shrink-0 transition-transform ${
        onClick ? "cursor-pointer hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1" : ""
      } ${styleClasses} ${className}`}
      aria-label={`Source ${number}`}
    >
      {number}
    </Component>
  );
};
