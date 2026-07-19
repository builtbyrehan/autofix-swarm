'use client';

import { useRef, useEffect, useState, CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface CounterAnimationProps {
  end: number;
  duration?: number;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}

const CounterAnimation: React.FC<CounterAnimationProps> = ({ 
  end, 
  duration = 2, 
  suffix = '',
  className = '',
  style
}) => {
  const counterRef = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!counterRef.current || hasAnimated) return;

    const counter = { value: 0 };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            gsap.to(counter, {
              value: end,
              duration,
              ease: 'power2.out',
              onUpdate: () => {
                if (counterRef.current) {
                  counterRef.current.textContent = Math.round(counter.value) + suffix;
                }
              }
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(counterRef.current);

    return () => observer.disconnect();
  }, [end, duration, suffix, hasAnimated]);

  return <span ref={counterRef} className={className} style={style}>0{suffix}</span>;
};

export default CounterAnimation;
