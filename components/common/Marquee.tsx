import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number; // Speed in pixels per second. Higher is faster.
  direction?: 'left' | 'right';
}

const Marquee: React.FC<MarqueeProps> = ({ children, speed = 50, direction = 'left' }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const controls = useAnimation();

  const startAnimation = useCallback((width: number) => {
    if (width > 0) {
      const xPoints = direction === 'left' ? [0, -width] : [-width, 0];
      controls.start({
        x: xPoints,
        transition: {
          ease: 'linear',
          duration: width / speed,
          repeat: Infinity,
        },
      });
    }
  }, [controls, speed, direction]);

  useEffect(() => {
    const calculateWidth = () => {
      if (contentRef.current) {
        // Content is duplicated for seamless loop, so actual width is half.
        const width = contentRef.current.scrollWidth / 2;
        setContentWidth(width);
        startAnimation(width);
      }
    };
    
    // Delay to ensure content is rendered and measurable
    const timer = setTimeout(calculateWidth, 100);
    window.addEventListener('resize', calculateWidth);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateWidth);
      controls.stop();
    };
  }, [children, speed, startAnimation]);

  return (
    <div className="w-full overflow-hidden cursor-grab">
      <motion.div
        className="inline-flex"
        drag="x"
        dragConstraints={{ right: 0, left: -contentWidth }}
        animate={controls}
        onHoverStart={() => controls.stop()}
        onHoverEnd={() => startAnimation(contentWidth)}
        whileTap={{ cursor: "grabbing" }}
      >
        {/* Duplicating children for a seamless loop effect */}
        <div ref={contentRef} className="flex whitespace-nowrap">
          {children}
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default Marquee;