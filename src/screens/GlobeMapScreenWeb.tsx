/**
 * Web implementation of GlobeMapScreen using react-globe.gl.
 * Same functionality and visual style as GlobeMapScreen.tsx, for browser rendering.
 * Use this when running in web (e.g. Expo web) instead of the expo-gl/Three native implementation.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { userAreaVisitsApi } from '../services/api';
import { ClimbingArea } from '../types';
import { GroupsStackParamList, MapStackParamList } from '../types';
import {
  getAllBorderPolylines,
  getUSStateBorderPolylines,
} from '../data/worldBorders';
import { StackNavigationProp } from '@react-navigation/stack';

type AreasMapNav =
  | StackNavigationProp<GroupsStackParamList, 'AreasMap'>
  | StackNavigationProp<MapStackParamList, 'MapMain'>;

const IDLE_TIMEOUT_MS = 2500;

// Same coordinate convention as GlobeMapScreen (lat/lng → 3D); react-globe.gl uses lat/lng directly.
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}
const AUTO_ROTATE_SPEED = 0.3;

// Points data item: area + lat/lng + hasFriends for color
interface PointItem {
  area: ClimbingArea;
  lat: number;
  lng: number;
  hasFriends: boolean;
}

const GlobeMapScreenWeb: React.FC = () => {
  const navigation = useNavigation<AreasMapNav>();
  const { user } = useAuth();
  const { climbingAreas, friends } = useApp();
  const [presence, setPresence] = useState<{ areaId: string; userId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<ClimbingArea | null>(null);
  const globeRef = useRef<any>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friendsByArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of presence) {
      const list = map.get(p.areaId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.areaId, list);
    }
    return map;
  }, [presence]);

  const friendName = (userId: string): string => {
    const f = friends.find((x) => x.id === userId);
    return f?.name ?? 'Friend';
  };

  const pointsData: PointItem[] = useMemo(
    () =>
      climbingAreas.map((area) => ({
        area,
        lat: area.latitude,
        lng: area.longitude,
        hasFriends: (friendsByArea.get(area.id) ?? []).length > 0,
      })),
    [climbingAreas, friendsByArea]
  );

  const pathsData = useMemo(() => {
    const country = getAllBorderPolylines();
    const usStates = getUSStateBorderPolylines();
    return [
      ...country.map((points) => ({ points })),
      ...usStates.map((points) => ({ points })),
    ];
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const api = __DEV__
      ? userAreaVisitsApi.getFriendsPresenceForUserWithTripTest(user.id)
      : userAreaVisitsApi.getFriendsPresenceForUser(user.id);
    api
      .then((data) => {
        if (!cancelled) setPresence(data);
      })
      .catch(() => {
        if (!cancelled) setPresence([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleViewArea = (areaId: string) => {
    setSelectedArea(null);
    navigation.navigate('AreaDetail', { areaId });
  };

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    if (!controls) return;

    const startAutoRotate = () => {
      controls.autoRotate = true;
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    };
    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };

    const onInteractionStart = () => {
      stopAutoRotate();
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const onInteractionEnd = () => {
      idleTimerRef.current = setTimeout(startAutoRotate, IDLE_TIMEOUT_MS);
    };

    controls.addEventListener('start', onInteractionStart);
    controls.addEventListener('end', onInteractionEnd);

    idleTimerRef.current = setTimeout(startAutoRotate, IDLE_TIMEOUT_MS);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      controls.removeEventListener('start', onInteractionStart);
      controls.removeEventListener('end', onInteractionEnd);
      stopAutoRotate();
    };
  }, [loading]);

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: 0x0a2a4a,
        emissive: 0x051520,
        shininess: 60,
        transparent: true,
        opacity: 0.95,
      }),
    []
  );

  const friendIdsForArea = selectedArea
    ? (friendsByArea.get(selectedArea.id) ?? [])
    : [];

  if (loading) {
    return (
      <div style={styles.centered}>
        <span style={styles.loadingText}>Loading globe...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          type="button"
          style={styles.backButton}
          onClick={() => navigation.goBack()}
          aria-label="Go back"
        >
          ←
        </button>
        <div style={styles.headerCenter}>
          <div style={styles.headerTitle}>CLIMBING AREAS</div>
          <div style={styles.headerSub}>{climbingAreas.length} areas worldwide</div>
        </div>
        <div style={styles.headerSpacer} />
      </header>

      <div style={styles.globeContainer}>
        <Globe
          ref={globeRef}
          width={typeof window !== 'undefined' ? window.innerWidth : 800}
          height={typeof window !== 'undefined' ? window.innerHeight - 180 : 500}
          backgroundColor="#020c18"
          showGlobe={true}
          showAtmosphere={true}
          atmosphereColor="lightskyblue"
          atmosphereAltitude={0.15}
          globeMaterial={globeMaterial}
          pointsData={pointsData}
          pointLat={(d: PointItem) => d.lat}
          pointLng={(d: PointItem) => d.lng}
          pointColor={(d: PointItem) => (d.hasFriends ? '#34C759' : '#4A9EFF')}
          pointAltitude={0.01}
          pointRadius={0.4}
          pointsMerge={false}
          onPointClick={(point: PointItem) => setSelectedArea(point.area)}
          pathsData={pathsData}
          pathPoints={(d: { points: [number, number][] }) => d.points}
          pathPointLat={(arr: [number, number]) => arr[1]}
          pathPointLng={(arr: [number, number]) => arr[0]}
          pathColor={() => 'rgba(42,107,160,0.35)'}
          pathStroke={null}
          pathResolution={2}
        />

        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <span style={[styles.legendDot, { backgroundColor: '#4A9EFF' }]} />
            <span style={styles.legendText}>Climbing area</span>
          </div>
          <div style={styles.legendItem}>
            <span style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
            <span style={styles.legendText}>Friends here</span>
          </div>
        </div>
        <div style={styles.hint}>Drag to rotate · Scroll to zoom · Auto-rotates when idle</div>
      </div>

      {selectedArea && (
        <div
          style={styles.modalOverlay}
          onClick={() => setSelectedArea(null)}
          role="presentation"
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Area details"
          >
            <div style={styles.modalHandle} />
            <div style={styles.modalTitle} title={selectedArea.name}>
              {selectedArea.name}
            </div>
            <div style={styles.modalLocation}>
              {[selectedArea.region, selectedArea.country].filter(Boolean).join(', ')}
            </div>
            {friendIdsForArea.length > 0 ? (
              <div style={styles.friendsBadge}>
                <span style={styles.friendsBadgeText}>
                  {friendIdsForArea.length === 1
                    ? `${friendName(friendIdsForArea[0])} is here`
                    : `${friendIdsForArea.map(friendName).join(', ')} are here`}
                </span>
              </div>
            ) : (
              <div style={styles.noFriends}>No friends at this area right now</div>
            )}
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.viewButton}
                onClick={() => handleViewArea(selectedArea.id)}
              >
                View Area →
              </button>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setSelectedArea(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#020c18',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '16px',
    paddingTop: 56,
    borderBottom: '1px solid rgba(74,158,255,0.15)',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#4A9EFF',
    fontSize: 22,
    cursor: 'pointer',
    padding: 4,
    width: 40,
  },
  headerSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#4A9EFF',
    letterSpacing: 3,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    letterSpacing: 1,
  },
  globeContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  legend: {
    display: 'flex',
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
  },
  legendItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    letterSpacing: 0.5,
  },
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020c18',
    minHeight: '100vh',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4A9EFF',
    letterSpacing: 1,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#0d1f33',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderTop: '1px solid rgba(74,158,255,0.2)',
    width: '100%',
    maxWidth: 480,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    margin: '0 auto 20px',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  modalLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  friendsBadge: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52,199,89,0.12)',
    padding: '8px 12px',
    borderRadius: 8,
    marginBottom: 20,
    border: '1px solid rgba(52,199,89,0.25)',
  },
  friendsBadgeText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: 500,
  },
  noFriends: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 20,
  },
  modalActions: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#4A9EFF',
    color: '#fff',
    border: 'none',
    padding: '14px 20px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '14px 20px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    cursor: 'pointer',
  },
};

export default GlobeMapScreenWeb;
