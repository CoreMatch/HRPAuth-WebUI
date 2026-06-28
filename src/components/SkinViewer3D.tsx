import { useEffect, useRef } from 'react';
import { SkinViewer } from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl?: string | null;
  capeUrl?: string | null;
  model?: 'default' | 'slim';
  width?: number;
  height?: number;
}

export default function SkinViewer3D({
  skinUrl,
  capeUrl,
  model = 'default',
  width = 200,
  height = 400,
}: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      skin: skinUrl || undefined,
      cape: capeUrl || undefined,
    });

    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 2;
    viewer.camera.position.z = 50;

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (skinUrl) {
      viewerRef.current.loadSkin(skinUrl, {
        model: model === 'slim' ? 'slim' : 'default',
      });
    } else {
      viewerRef.current.loadSkin(null);
    }
  }, [skinUrl, model]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (capeUrl) {
      viewerRef.current.loadCape(capeUrl);
    } else {
      viewerRef.current.loadCape(null);
    }
  }, [capeUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}