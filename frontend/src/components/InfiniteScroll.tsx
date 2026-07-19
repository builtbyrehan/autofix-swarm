'use client';

import { useRef, useEffect, ReactNode } from 'react';
import { gsap } from 'gsap';

interface InfiniteScrollProps {
  children: ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
}

const InfiniteScroll: React.FC<InfiniteScrollProps> = ({
  children,
  speed = 30,
  direction = 'left',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const content = contentRef.current;
    const clone = content.cloneNode(true) as HTMLDivElement;
    containerRef.current.appendChild(clone);

    const contentWidth = content.offsetWidth;
    const directionMultiplier = direction === 'left' ? -1 : 1;

    const animation = gsap.to([content, clone], {
      x: directionMultiplier * contentWidth,
      duration: speed,
      ease: 'none',
      repeat: -1,
      modifiers: {
        x: (x) => {
          const value = parseFloat(x);
          return `${value % contentWidth}px`;
        }
      }
    });

    return () => {
      animation.kill();
      if (clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
    };
  }, [speed, direction]);

  return (
    <div
      ref={containerRef}
      className={`flex overflow-x-hidden overflow-y-visible ${className}`}
    >
      <div ref={contentRef} className="flex flex-shrink-0 items-center">
        {children}
      </div>
    </div>
  );
};

export default InfiniteScroll;