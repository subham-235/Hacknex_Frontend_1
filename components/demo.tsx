'use client';

import Image from 'next/image';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';

export function HeroScrollDemo() {
  return (
    <section aria-labelledby="scroll-preview-title" className="overflow-hidden">
      <ContainerScroll titleComponent={
        <>
          <p className="eyebrow">YOUR SAFETY, CONNECTED</p>
          <h2 id="scroll-preview-title" className="text-4xl font-semibold text-foreground">
            A clearer view.<br />
            <span className="mt-2 block text-5xl font-bold leading-none md:text-7xl">A little peace of mind.</span>
          </h2>
          <p className="mt-6 text-muted-foreground">Your people. Your voice. Support that follows through.</p>
        </>
      }>
        <Image
          src="https://ui.aceternity.com/_next/image?url=%2Flinear.webp&w=3840&q=75"
          alt="Example workspace interface illustrating the scroll animation"
          height={720}
          width={1400}
          className="mx-auto h-full rounded-2xl object-cover object-left-top"
          draggable={false}
          unoptimized
        />
      </ContainerScroll>
    </section>
  );
}
