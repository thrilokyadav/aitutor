import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// FIX: Use framer-motion's HTMLMotionProps to avoid type conflicts with React.HTMLAttributes.
// This ensures that props like event handlers are compatible with motion components.
interface CardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <motion.div 
        className={`bg-[rgb(var(--color-card))] border border-[rgb(var(--color-border))] rounded-xl p-6 ${className}`} 
        whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300 } }}
        {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
