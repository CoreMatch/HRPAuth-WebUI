import { useEffect, useRef } from 'react';
import { SkinViewer } from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl?: string | null;
  capeUrl?: string | null;
  width?: number;
  height?: number;
}

export default function SkinViewer3D({
  skinUrl,
  capeUrl,
  width = 200,
  height = 400,
}: SkinViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 诊断：用临时 canvas 检测 WebGL 支持（不影响目标 canvas 的 context）
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    console.log('[SkinViewer3D] WebGL 支持:', gl ? 'OK' : '不支持', gl ? gl.getParameter(gl.RENDERER) : '');

    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width,
      height,
      skin: skinUrl || undefined,
      cape: capeUrl || undefined,
    });

    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;
    // skinview3d v3 默认相机在 z=1；将相机拉到 z=50 会让模型缩小到几乎不可见。
    // 改用 zoom 控制取景，使全身（高约 1.8 单位）在竖版画布中完整可见。
    viewer.zoom = 0.5;

    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (skinUrl) {
      viewerRef.current.loadSkin(skinUrl).catch((err) => {
        console.error('[SkinViewer3D] 皮肤纹理加载失败:', skinUrl, err);
      });
    } else {
      viewerRef.current.loadSkin(null);
    }
  }, [skinUrl]);

  useEffect(() => {
    if (!viewerRef.current) return;

    if (capeUrl) {
      viewerRef.current.loadCape(capeUrl).catch((err) => {
        console.error('[SkinViewer3D] 披风纹理加载失败:', capeUrl, err);
      });
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
