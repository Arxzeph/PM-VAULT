import React, { useState, useRef, useCallback } from "react";

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
  dist: number;
  size: number;
}

export interface ClickSparkProps {
  children: React.ReactNode;
  sparkColor?: string;
  sparkCount?: number;
  className?: string;
}

export const ClickSpark: React.FC<ClickSparkProps> = ({
  children,
  sparkColor = "#FFFFFF",
  sparkCount = 8,
  className = "",
}) => {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const nextId = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newSparks: Spark[] = Array.from({ length: sparkCount }).map((_, i) => ({
        id: nextId.current++,
        x,
        y,
        angle: (i * (360 / sparkCount) + Math.random() * 20) * (Math.PI / 180),
        dist: 20 + Math.random() * 18,
        size: 2.5 + Math.random() * 1.5,
      }));

      setSparks((prev) => [...prev, ...newSparks]);

      setTimeout(() => {
        setSparks((prev) => prev.filter((s) => !newSparks.some((ns) => ns.id === s.id)));
      }, 450);
    },
    [sparkCount]
  );

  return (
    <div className={`relative ${className}`} onClick={handleClick}>
      {children}
      {sparks.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-50"
          style={{ willChange: "transform" }}
        >
          {sparks.map((spark) => {
            const targetX = spark.x + Math.cos(spark.angle) * spark.dist;
            const targetY = spark.y + Math.sin(spark.angle) * spark.dist;
            return (
              <circle
                key={spark.id}
                cx={targetX}
                cy={targetY}
                r={spark.size}
                fill={sparkColor}
                className="animate-ping opacity-90"
                style={{
                  animationDuration: "450ms",
                  animationTimingFunction: "ease-out",
                }}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
};
