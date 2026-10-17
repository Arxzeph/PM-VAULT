import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

export interface StarBorderProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
  color?: string;
  trailColor?: string;
  speed?: string;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  children,
  className = "",
  color = "#6366F1",
  trailColor = "#38BDF8",
  speed = "4s",
  ...props
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative inline-flex items-center justify-center p-[1px] overflow-hidden rounded-xl group transition-all cursor-pointer isolation-auto ${className}`}
      {...props}
    >
      {/* Animated rotating border glow with tight subpixel containment */}
      <span
        className="absolute inset-[-250%] animate-[spin_4s_linear_infinite] pointer-events-none"
        style={{
          background: `conic-gradient(from 90deg at 50% 50%, transparent 0%, transparent 72%, ${color} 90%, ${trailColor} 100%)`,
        }}
      />
      {/* Inner surface matching outer radius without gap */}
      <span className="relative z-10 w-full h-full rounded-[11px] bg-[#161B26] hover:bg-[#1C2333] transition-colors flex items-center justify-center px-4 py-2 font-sans font-semibold text-xs text-white">
        {children}
      </span>
    </motion.button>
  );
};
