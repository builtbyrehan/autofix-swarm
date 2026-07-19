'use client';

import { useRef, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: 'left' | 'right' | 'bottom' | 'top';
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  className = '', 
  delay = 0,
  from = 'bottom'
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;

    const fromVars: Record<string, number | string> = {
      opacity: 0,
      scale: 0.95
    };

    switch (from) {
      case 'left':
        fromVars.x = -100;
        break;
      case 'right':
        fromVars.x = 100;
        break;
      case 'top':
        fromVars.y = -100;
        break;
      case 'bottom':
        fromVars.y = 100;
        break;
    }

    gsap.fromTo(
      cardRef.current,
      fromVars,
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 1,
        delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top 85%',
          end: 'bottom 15%',
          toggleActions: 'play none none reverse'
        }
      }
    );
  }, { scope: cardRef });

  return (
    <div ref={cardRef} className={className}>
      {children}
    </div>
  );
};

export default AnimatedCard;
