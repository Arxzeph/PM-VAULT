import React, { useState, useEffect, useRef } from "react";

const DEFAULT_CHARS = "0123456789ABCDEFabcdef!@#$%^&*()_+-=[]{}|;:,.<>?";

export interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  characters?: string;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: "view" | "hover";
}

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 12,
  sequential = true,
  characters = DEFAULT_CHARS,
  className = "",
  parentClassName = "",
  encryptedClassName = "text-zinc-500 opacity-80 font-mono",
  animateOn = "hover",
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isScrambling, setIsScrambling] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  const startScramble = () => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayText(text);
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsScrambling(true);

    let iteration = 0;
    const len = text.length;

    intervalRef.current = window.setInterval(() => {
      setDisplayText(() => {
        let revealedCount = sequential
          ? Math.floor((iteration / maxIterations) * len)
          : Math.floor(iteration / 2);

        return text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < revealedCount) return text[index];
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("");
      });

      iteration++;
      if (iteration > maxIterations) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
        setIsScrambling(false);
      }
    }, speed);
  };

  useEffect(() => {
    setDisplayText(text);
    if (animateOn === "view") {
      startScramble();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, animateOn]);

  return (
    <span
      className={`inline-block select-none ${parentClassName}`}
      onMouseEnter={() => {
        if (animateOn === "hover" && !isScrambling) startScramble();
      }}
    >
      <span className={`${className} ${isScrambling ? encryptedClassName : ""}`}>
        {displayText}
      </span>
    </span>
  );
};
