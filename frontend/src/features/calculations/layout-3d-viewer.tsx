import { OrbitControls, Text } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { PackedBox } from "../../lib/types";

interface Layout3DViewerProps {
  boxes: PackedBox[];
  showLabels?: boolean;
  activeName?: string;
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

export function Layout3DViewer({ boxes, showLabels, activeName, containerShell }: Layout3DViewerProps) {
  const MAX_RENDER_ITEMS = 420;
  const safeBoxes = boxes.slice(0, MAX_RENDER_ITEMS);

  // Одна геометрия единичного куба переиспользуется всеми коробками и каркасом
  // через scale — это дёшево и не плодит объекты.
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const unitEdges = useMemo(() => new THREE.EdgesGeometry(unitBox), [unitBox]);
  useEffect(() => {
    return () => {
      unitBox.dispose();
      unitEdges.dispose();
    };
  }, [unitBox, unitEdges]);

  const bounds = useMemo(() => {
    const shellW = containerShell?.width ?? 0;
    const shellH = containerShell?.height ?? 0;
    const shellD = containerShell?.depth ?? 0;

    if (!safeBoxes.length) {
      return { maxX: shellW || 1000, maxY: shellH || 1000, maxZ: shellD || 1000 };
    }

    return {
      maxX: Math.max(...safeBoxes.map((item) => item.x + item.width), shellW),
      maxY: Math.max(...safeBoxes.map((item) => item.y + item.height), shellH),
      maxZ: Math.max(...safeBoxes.map((item) => item.z + item.depth), shellD)
    };
  }, [safeBoxes, containerShell]);

  const rawMaxDim = Math.max(bounds.maxX, bounds.maxY, bounds.maxZ);
  const targetMaxDim = 900;
  const scale = rawMaxDim > targetMaxDim ? targetMaxDim / rawMaxDim : 1;
  const maxDim = rawMaxDim * scale;
  const cameraDistance = Math.max(1200, maxDim * 1.8);
  const shouldShowLabels = showLabels ?? safeBoxes.length <= 100;

  const fillPercent = containerShell?.volumeUtilizationPercent ?? null;
  const freePercent = fillPercent != null ? Math.max(0, 100 - fillPercent) : null;

  const shell = containerShell
    ? {
        w: containerShell.width * scale,
        h: containerShell.height * scale,
        d: containerShell.depth * scale,
        cx: (containerShell.width / 2) * scale,
        cy: (containerShell.height / 2) * scale,
        cz: (containerShell.depth / 2) * scale
      }
    : null;

  return (
    <motion.div
      className="viewer3d"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {fillPercent != null ? (
        <div className="viewerOccupancy">
          <div className="viewerOccupancyTop">
            <span className="viewerOccupancyLabel">ЗАПОЛНЕНИЕ</span>
            <span className="viewerOccupancyValue">{fillPercent.toFixed(1)}%</span>
          </div>
          <div className="viewerFill">
            <div className="viewerFillBar" style={{ width: `${Math.min(100, fillPercent)}%` }} />
          </div>
          <div className="viewerOccupancyFree">
            Свободно {(freePercent ?? 0).toFixed(1)}%{activeName ? ` · ${activeName}` : ""}
          </div>
        </div>
      ) : null}

      <div className="viewerHint">ПЕРЕТАЩИТЕ — ВРАЩЕНИЕ · КОЛЕСО — ЗУМ</div>

      <Canvas
        frameloop="always"
        dpr={[1, 1.5]}
        camera={{ position: [cameraDistance, cameraDistance, cameraDistance], fov: 35, near: 0.1, far: 100000 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight intensity={0.85} position={[cameraDistance * 0.5, cameraDistance, cameraDistance * 0.8]} />
        <directionalLight intensity={0.4} color="#b18cff" position={[-cameraDistance * 0.6, cameraDistance * 0.5, -cameraDistance * 0.5]} />

        {shell ? (
          <group position={[shell.cx, shell.cy, shell.cz]}>
            <mesh geometry={unitBox} scale={[shell.w, shell.h, shell.d]} renderOrder={-1}>
              <meshStandardMaterial color="#b18cff" transparent opacity={0.04} depthWrite={false} />
            </mesh>
            <lineSegments geometry={unitEdges} scale={[shell.w, shell.h, shell.d]}>
              <lineBasicMaterial color="#b18cff" transparent opacity={0.55} />
            </lineSegments>
          </group>
        ) : null}

        <gridHelper args={[maxDim * 3, 26, "#5a5478", "#231f33"]} />

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
              <mesh geometry={unitBox} scale={[w, h, d]}>
                <meshStandardMaterial color={box.color} transparent opacity={0.92} roughness={0.5} metalness={0.08} />
              </mesh>
              <lineSegments geometry={unitEdges} scale={[w, h, d]}>
                <lineBasicMaterial color="#ffffff" transparent opacity={0.13} />
              </lineSegments>
              {labelAllowed ? (
                <Text position={[0, h / 2 + 6, 0]} fontSize={Math.max(10, 18 * scale)} color="#f4f7ff" anchorX="center" anchorY="middle">
                  {box.label}
                </Text>
              ) : null}
            </group>
          );
        })}

        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={0.7}
          enableDamping
          dampingFactor={0.08}
          target={shell ? [shell.cx, shell.cy, shell.cz] : [0, 0, 0]}
          minDistance={maxDim * 0.45}
          maxDistance={maxDim * 20}
        />
      </Canvas>

      {boxes.length > MAX_RENDER_ITEMS ? (
        <div className="viewerNotice">
          Показаны первые {MAX_RENDER_ITEMS} из {boxes.length} объектов
        </div>
      ) : null}
    </motion.div>
  );
}
