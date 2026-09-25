'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';

export function ContainerScroll({ titleComponent, children }: {
  titleComponent: ReactNode;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end end'] });
  const [isMobile, setIsMobile] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const rotate = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : isMobile ? [0.7, 0.9] : [1.05, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [0, -100]);

  return (
    <div className="relative flex min-h-[48rem] items-center justify-center px-2 py-24 md:min-h-[64rem] md:px-10" ref={containerRef}>
      <div className="relative w-full" style={{ perspective: '1000px' }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} scale={scale}>{children}</Card>
      </div>
    </div>
  );
}

export function Header({ translate, titleComponent }: {
  translate: MotionValue<number>;
  titleComponent: ReactNode;
}) {
  return (
    <motion.div style={{ translateY: translate }} className="mx-auto mb-16 max-w-5xl text-center">
      {titleComponent}
    </motion.div>
  );
}

export function Card({ rotate, scale, children }: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.div
      style={{ rotateX: rotate, scale, boxShadow: '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003' }}
      className="mx-auto h-[26rem] w-full max-w-5xl rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 shadow-2xl md:h-[40rem] md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:p-4">
        {children}
      </div>
    </motion.div>
  );
}
