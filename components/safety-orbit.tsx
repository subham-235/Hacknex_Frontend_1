'use client';
import { useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';

/** Decorative geometry, never a live monitoring indicator. */
export function SafetyOrbit() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};
    void import('three')
      .then((THREE) => {
        if (disposed) return;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        } catch {
          return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        element.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
        camera.position.z = 6.2;
        const group = new THREE.Group();
        scene.add(group);
        const geometry = new THREE.IcosahedronGeometry(1.12, 2);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({
          color: '#d0ef86',
          transparent: true,
          opacity: 0.36,
        });
        const core = new THREE.LineSegments(edges, material);
        group.add(core);
        const rings = [0, 1, 2].map((i) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.55 + i * 0.15, 0.009, 8, 100),
            new THREE.MeshBasicMaterial({
              color: i === 1 ? '#b7c7ad' : '#d0ef86',
              transparent: true,
              opacity: 0.55,
            }),
          );
          ring.rotation.set(0.7 + i * 0.8, 0.4 + i * 0.6, i * 0.8);
          group.add(ring);
          return ring;
        });
        const dots = new Float32Array(90 * 3);
        for (let i = 0; i < 90; i++) {
          const angle = i * 2.39996,
            y = 1 - (i / 89) * 2,
            radius = Math.sqrt(1 - y * y) * 2;
          dots.set(
            [Math.cos(angle) * radius, y * 2, Math.sin(angle) * radius],
            i * 3,
          );
        }
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute(
          'position',
          new THREE.BufferAttribute(dots, 3),
        );
        const particleMaterial = new THREE.PointsMaterial({
          color: '#e0efbc',
          size: 0.028,
          transparent: true,
          opacity: 0.7,
        });
        group.add(new THREE.Points(particleGeometry, particleMaterial));
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        let visible = true;
        const render = (time: number) => {
          const t = time * 0.00015;
          group.rotation.y = t;
          core.rotation.z = t * 0.4;
          rings.forEach((ring, i) => {
            ring.rotation.z = i * 0.8 + t * (i % 2 ? -0.5 : 0.5);
          });
          renderer.render(scene, camera);
        };
        const sync = () => {
          renderer.setAnimationLoop(null);
          if (visible && !document.hidden && !media.matches)
            renderer.setAnimationLoop(render);
          else if (visible && !document.hidden) renderer.render(scene, camera);
        };
        const resize = new ResizeObserver(() => {
          const { width, height } = element.getBoundingClientRect();
          if (!width || !height) return;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        });
        resize.observe(element);
        const intersection = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
        intersection.observe(element);
        media.addEventListener('change', sync);
        document.addEventListener('visibilitychange', sync);
        const contextLost = (event: Event) => {
          event.preventDefault();
          renderer.setAnimationLoop(null);
        };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        sync();
        cleanup = () => {
          renderer.setAnimationLoop(null);
          resize.disconnect();
          intersection.disconnect();
          media.removeEventListener('change', sync);
          document.removeEventListener('visibilitychange', sync);
          renderer.domElement.removeEventListener(
            'webglcontextlost',
            contextLost,
          );
          geometry.dispose();
          edges.dispose();
          material.dispose();
          particleGeometry.dispose();
          particleMaterial.dispose();
          rings.forEach((ring) => {
            ring.geometry.dispose();
            ring.material.dispose();
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        /* Static shield remains if WebGL or module loading fails. */
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  return (
    <div className="safety-orbit" aria-hidden="true">
      <div ref={host} className="orbit-canvas" />
      <div className="orbit-shield">
        <ShieldCheck strokeWidth={1.3} />
      </div>
      <span className="orbit-label">YOUR SAFETY, CONNECTED</span>
    </div>
  );
}
