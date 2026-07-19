"use client";

import { forwardRef, useCallback, useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { motion as fm, type HTMLMotionProps } from "framer-motion";
import { DURATION } from "@/lib/easing";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden",
    "font-medium rounded-md select-none",
    "transition-[transform,box-shadow,background-color,border-color]",
    "duration-200 ease-primary",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "text-primary-foreground font-semibold",
          "bg-gradient-to-br from-cyan-400 to-teal-500",
          "shadow-elev2 hover:shadow-glow-cyan",
          "hover:brightness-110",
        ].join(" "),
        secondary: [
          "text-foreground bg-glass-bg/50 backdrop-blur-md",
          "border border-glass-border/10 hover:border-primary/40",
          "shadow-elev1 hover:shadow-elev2",
        ].join(" "),
        ghost: [
          "text-muted-foreground hover:text-foreground",
          "hover:bg-card/40",
        ].join(" "),
        danger: [
          "text-destructive-foreground",
          "bg-gradient-to-br from-red-500 to-red-600",
          "shadow-elev2 hover:shadow-glow-error",
          "hover:brightness-110",
        ].join(" "),
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  animated?: boolean;
  /** Show a ripple wave on click. */
  ripple?: boolean;
}

/** A single ripple ring instance. */
interface Ripple {
  id: number;
  x: number;
  y: number;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    animated = true,
    ripple: enableRipple = true,
    children,
    type,
    onClick,
    ...rest
  },
  ref
) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!enableRipple) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++rippleId.current;
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    },
    [onClick, enableRipple]
  );

  const classes = buttonVariants({ variant, size, className });

  const content = (
    <>
      {children}
      {enableRipple && ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: r.x - 8,
            top: r.y - 8,
            width: 16,
            height: 16,
            background: "hsl(var(--foreground) / 0.15)",
            transform: "scale(0)",
            animation: "ripple-wave 0.6s ease-out forwards",
          }}
        />
      ))}
    </>
  );

  if (asChild) {
    // Radix Slot merges props onto exactly one child element. The `content`
    // Fragment (children + ripple spans) breaks that, so for asChild we pass
    // children directly — ripples are skipped on slotted buttons.
    return (
      <Slot className={classes} ref={ref} onClick={handleClick} {...(rest as object)}>
        {children}
      </Slot>
    );
  }

  if (!animated) {
    return (
      <button ref={ref} type={type ?? "button"} className={classes} onClick={handleClick} {...rest}>
        {content}
      </button>
    );
  }

  const {
    onAnimationStart,
    onDragStart,
    onDragEnd,
    onDrag,
    ...motionProps
  } = rest as HTMLMotionProps<"button">;

  const MotionButton = fm.button;
  return (
    <MotionButton
      ref={ref}
      type={type ?? "button"}
      className={classes}
      whileHover={{ y: -1, translateZ: 4 }}
      whileTap={{ scale: 0.97, translateZ: -6 }}
      style={{ transformStyle: "preserve-3d" }}
      transition={{ duration: DURATION.micro }}
      onClick={handleClick}
      {...motionProps}
    >
      {content}
    </MotionButton>
  );
});

export { buttonVariants };
