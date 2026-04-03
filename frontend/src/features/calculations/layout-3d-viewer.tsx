import { OrbitControls, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { PackedBox } from "../../lib/types";

interface Layout3DViewerProps {
  boxes: PackedBox[];
  containerShell?: {
    width: number;
    height: number;
    depth: number;
    volumeUtilizationPercent?: number;
    areaUtilizationPercent?: number;
    usedVolumeM3?: number;
    capacityVolumeM3?: number;
  };
}

export function Layout3DViewer({
  boxes,
  showLabels,
  containerShell
}: Layout3DViewerProps & { showLabels?: boolean }) {
  const MAX_RENDER_ITEMS = 420;
  const safeBoxes = boxes.slice(0, MAX_RENDER_ITEMS);
  const bounds = useMemo(() => {
    const shellW = containerShell?.width ?? 0;
    const shellH = containerShell?.height ?? 0;
    const shellD = containerShell?.depth ?? 0;

    if (!safeBoxes.length) {
      const w = shellW || 1000;
      const h = shellH || 1000;
      const d = shellD || 1000;
      return { maxX: w, maxY: h, maxZ: d };
    }

    return {
      maxX: Math.max(...safeBoxes.map((item) => item.x + item.width), shellW),
      maxY: Math.max(...safeBoxes.map((item) => item.y + item.height), shellH),
      maxZ: Math.max(...safeBoxes.map((item) => item.z + item.depth), shellD)
    };
  }, [safeBoxes, containerShell]);

  const rawMaxDim = Math.max(bounds.maxX, bounds.maxY, bounds.maxZ);
  const targetMaxDim = 900; // "world" size cap for stable camera + performance
  const scale = rawMaxDim > targetMaxDim ? targetMaxDim / rawMaxDim : 1;
  const maxDim = rawMaxDim * scale;
  const cameraDistance = Math.max(1200, maxDim * 1.8);
  const shouldShowLabels = showLabels ?? safeBoxes.length <= 100;
  const freePercent =
    containerShell?.volumeUtilizationPercent != null
      ? Math.max(0, 100 - containerShell.volumeUtilizationPercent)
      : null;

  return (
    <motion.div
      className="viewer3d"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {containerShell?.volumeUtilizationPercent != null ? (
        <div className="viewerOccupancy">
          <div>
            Заполнение: <strong>{containerShell.volumeUtilizationPercent.toFixed(1)}%</strong>
          </div>
          <div>
            Свободно: <strong>{(freePercent ?? 0).toFixed(1)}%</strong>
          </div>
        </div>
      ) : null}
      <Canvas
        frameloop="demand"
        dpr={[1, 1.25]}
        camera={{
          position: [cameraDistance, cameraDistance, cameraDistance],
          fov: 35,
          near: 0.1,
          far: 100000
        }}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          intensity={1.15}
          position={[cameraDistance * 0.5, cameraDistance, cameraDistance * 0.8]}
        />

        {containerShell ? (() => {
          const cw = containerShell.width * scale;
          const ch = containerShell.height * scale;
          const cd = containerShell.depth * scale;
          const cx = (containerShell.width / 2) * scale;
          const cy = (containerShell.height / 2) * scale;
          const cz = (containerShell.depth / 2) * scale;

          return (
            <group position={[cx, cy, cz]} renderOrder={-1}>
              <mesh renderOrder={-2}>
                <boxGeometry args={[cw, ch, cd]} />
                <meshStandardMaterial color="#4d8dff" transparent opacity={0.05} depthWrite={false} />
              </mesh>
              <mesh renderOrder={-1}>
                <boxGeometry args={[cw, ch, cd]} />
                <meshBasicMaterial color="#4d8dff" transparent opacity={0.28} wireframe depthWrite={false} />
              </mesh>
            </group>
          );
        })() : null}

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
          <planeGeometry args={[maxDim * 5, maxDim * 5]} />
          <meshStandardMaterial color="#0f1624" />
        </mesh>

        <gridHelper args={[maxDim * 5, 45, "#4d8dff", "#2a3550"]} />
        {safeBoxes.map((box, idx) => {
          const w = box.width * scale;
          const h = box.height * scale;
          const d = box.depth * scale;
          const cx = (box.x + box.width / 2) * scale;
          const cy = (box.y + box.height / 2) * scale;
          const cz = (box.z + box.depth / 2) * scale;
          const labelAllowed = shouldShowLabels && idx < 140;

          return (
            <group key={box.id} position={[cx, cy, cz]}>
              <mesh>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={box.color} transparent opacity={0.88} />
              </mesh>
              {labelAllowed ? (
                <Text
                  position={[0, h / 2 + 6, 0]}
                  fontSize={Math.max(10, 18 * scale)}
                  color="#f4f7ff"
                  anchorX="center"
                  anchorY="middle"
                >
                  {box.label}
                </Text>
              ) : null}
            </group>
          );
        })}
        <OrbitControls
          makeDefault
          target={
            containerShell
              ? [
                  (containerShell.width / 2) * scale,
                  (containerShell.height / 2) * scale,
                  (containerShell.depth / 2) * scale
                ]
              : [0, 0, 0]
          }
          minDistance={maxDim * 0.45}
          maxDistance={maxDim * 20}
        />
      </Canvas>
      {boxes.length > MAX_RENDER_ITEMS ? (
        <div className="viewerNotice">
          Показаны первые {MAX_RENDER_ITEMS} объектов из {boxes.length} для стабильной работы 3D.
        </div>
      ) : null}
    </motion.div>
  );
}
