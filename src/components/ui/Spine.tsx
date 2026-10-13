"use client";

import React, { useState } from "react";

export interface SpineCell {
  id: string | number;
  label?: string;
  status?: "read" | "unread" | "active" | "neutral";
  color?: string;
}

export interface SpineTick {
  id: string | number;
  position: number; // 0 to 1 normalized, or index / total
  color?: string; // marker yellow (#FFD84D) or significance color
  label?: string;
  tooltip?: string;
  data?: any;
}

export interface SpineProps {
  cells?: SpineCell[] | number; // array of cells or total cell count
  ticks?: SpineTick[];
  activePosition?: number; // 0 to 1 for scroll thumb
  onSelect?: (index: number, tick?: SpineTick) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
  thickness?: number; // 10 to 14px (DESIGN.md)
}

export function Spine({
  cells = 40,
  ticks = [],
  activePosition,
  onSelect,
  orientation = "horizontal",
  className = "",
  thickness = 12,
}: SpineProps) {
  const [hoveredTick, setHoveredTick] = useState<SpineTick | null>(null);

  const cellList: SpineCell[] = Array.isArray(cells)
    ? cells
    : Array.from({ length: Math.max(1, cells) }, (_, i) => ({
        id: i,
        status: "neutral",
      }));

  const isVertical = orientation === "vertical";

  return (
    <div
      className={`relative select-none ${
        isVertical
          ? `w-[${thickness}px] h-full flex flex-col`
          : `h-[${thickness}px] w-full flex flex-row`
      } ${className}`}
      style={{
        [isVertical ? "width" : "height"]: `${thickness}px`,
      }}
    >
      {/* 1. Underlying Cells Grid */}
      <div
        className={`flex-1 flex gap-[1.5px] rounded-[3px] overflow-hidden bg-[#ECEBF5] ${
          isVertical ? "flex-col h-full w-full" : "flex-row w-full h-full"
        }`}
      >
        {cellList.map((cell, idx) => {
          let bg = "bg-[#ECEBF5]"; // sunken
          if (cell.status === "read") bg = "bg-[#0B7A5F]"; // seal
          if (cell.status === "active") bg = "bg-[#17142B]"; // ink
          if (cell.color) bg = cell.color;

          return (
            <div
              key={cell.id}
              onClick={() => onSelect?.(idx)}
              className={`flex-1 transition-colors ${
                cell.color ? "" : bg
              } hover:opacity-80 cursor-pointer`}
              style={cell.color ? { backgroundColor: cell.color } : {}}
              title={cell.label || `Section ${idx + 1}`}
            />
          );
        })}
      </div>

      {/* 2. Marker / Citation Ticks */}
      {ticks.map((tick) => {
        const pct = Math.max(0, Math.min(100, tick.position * 100));
        const tickColor = tick.color || "#FFD84D"; // marker yellow

        return (
          <div
            key={tick.id}
            onMouseEnter={() => setHoveredTick(tick)}
            onMouseLeave={() => setHoveredTick(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(Math.round(tick.position * cellList.length), tick);
            }}
            className="absolute z-10 cursor-pointer hover:scale-125 transition-transform"
            style={
              isVertical
                ? {
                    top: `${pct}%`,
                    left: 0,
                    width: `${thickness}px`,
                    height: "3px",
                    backgroundColor: tickColor,
                    boxShadow: "0 0 2px rgba(23,20,43,0.3)",
                  }
                : {
                    left: `${pct}%`,
                    top: 0,
                    width: "3px",
                    height: `${thickness}px`,
                    backgroundColor: tickColor,
                    boxShadow: "0 0 2px rgba(23,20,43,0.3)",
                  }
            }
          />
        );
      })}

      {/* 3. Hover Tooltip for Ticks */}
      {hoveredTick && (
        <div
          className="absolute z-30 pointer-events-none px-2 py-1 rounded-[6px] bg-[#17142B] text-white text-[11px] font-sans shadow-lg whitespace-nowrap"
          style={
            isVertical
              ? {
                  top: `${hoveredTick.position * 100}%`,
                  right: `${thickness + 8}px`,
                  transform: "translateY(-50%)",
                }
              : {
                  left: `${hoveredTick.position * 100}%`,
                  bottom: `${thickness + 6}px`,
                  transform: "translateX(-50%)",
                }
          }
        >
          {hoveredTick.tooltip || hoveredTick.label || "Citation location"}
        </div>
      )}

      {/* 4. Active Scroll Position Indicator (Reading Desk) */}
      {typeof activePosition === "number" && (
        <div
          className="absolute z-20 pointer-events-none transition-all duration-75"
          style={
            isVertical
              ? {
                  top: `${Math.max(0, Math.min(100, activePosition * 100))}%`,
                  left: -2,
                  right: -2,
                  height: "4px",
                  borderRadius: "2px",
                  backgroundColor: "#4B3FD6", // indigo
                  boxShadow: "0 0 4px rgba(75,63,214,0.5)",
                }
              : {
                  left: `${Math.max(0, Math.min(100, activePosition * 100))}%`,
                  top: -2,
                  bottom: -2,
                  width: "4px",
                  borderRadius: "2px",
                  backgroundColor: "#4B3FD6",
                  boxShadow: "0 0 4px rgba(75,63,214,0.5)",
                }
          }
        />
      )}
    </div>
  );
}
