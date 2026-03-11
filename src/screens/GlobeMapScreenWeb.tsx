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
import { ClimbingArea, Gym } from '../types';
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

type MapMode = 'areas' | 'gyms';

interface PointItem {
  lat: number;
  lng: number;
  hasFriends: boolean;
  area?: ClimbingArea;
  gym?: Gym;
}

const GlobeMapScreenWeb: React.FC = () => {
  const navigation = useNavigation<AreasMapNav>();
  const { user } = useAuth();
  const { climbingAreas, gyms, friends, presence: gymPresence } = useApp();
  const [mapMode, setMapMode] = useState<MapMode>('areas');
  const [areaPresence, setAreaPresence] = useState<{ areaId: string; userId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<ClimbingArea | null>(null);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const globeRef = useRef<any>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const friendsByArea = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of areaPresence) {
      const list = map.get(p.areaId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.areaId, list);
    }
    return map;
  }, [areaPresence]);

  const friendsByGym = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of gymPresence) {
      if (!p.isActive || !friendIds.has(p.userId)) continue;
      const list = map.get(p.gymId) ?? [];
      if (!list.includes(p.userId)) list.push(p.userId);
      map.set(p.gymId, list);
    }
    return map;
  }, [gymPresence, friendIds]);

  const friendName = (userId: string): string => {
    const f = friends.find((x) => x.id === userId);
    return f?.name ?? 'Friend';
  };

  const pointsData: PointItem[] = useMemo(() => {
    if (mapMode === 'areas') {
      return climbingAreas.map((area) => ({
        lat: area.latitude,
        lng: area.longitude,
        hasFriends: (friendsByArea.get(area.id) ?? []).length > 0,
        area,
      }));
    }
    return gyms
      .filter((g) => typeof g.latitude === 'number' && typeof g.longitude === 'number')
      .map((gym) => ({
        lat: gym.latitude,
        lng: gym.longitude,
        hasFriends: (friendsByGym.get(gym.id) ?? []).length > 0,
        gym,
      }));
  }, [mapMode, climbingAreas, gyms, friendsByArea, friendsByGym]);

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
        if (!cancelled) setAreaPresence(data);
      })
      .catch(() => {
        if (!cancelled) setAreaPresence([]);
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
    setSelectedGym(null);
    (navigation as any).navigate('AreaDetail', { areaId });
  };

  const handleViewGym = (gymId: string) => {
    setSelectedArea(null);
    setSelectedGym(null);
    (navigation as any).navigate('GymDetail', { gymId });
  };

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const controls = globe.controls();
    if (!controls) return;

    // Allow zooming in much closer so gyms in the same city stay distinct
    if (typeof controls.minDistance !== 'undefined') {
      controls.minDistance = 1.15; // globe radius ~1 → camera can get to ~0.15 from surface
    }
    if (typeof controls.maxDistance !== 'undefined') {
      controls.maxDistance = 400; // keep default or generous max
    }

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
  const friendIdsForGym = selectedGym
    ? (friendsByGym.get(selectedGym.id) ?? [])
    : [];
  const modalVisible = selectedArea !== null || selectedGym !== null;

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
          <div style={styles.headerTitle}>
            {mapMode === 'areas' ? 'CLIMBING AREAS' : 'GYMS'}
          </div>
          <div style={styles.headerSub}>
            {mapMode === 'areas'
              ? `${climbingAreas.length} areas worldwide`
              : `${gyms.filter((g) => typeof g.latitude === 'number' && typeof g.longitude === 'number').length} gyms worldwide`}
          </div>
        </div>
        <div style={styles.headerSpacer} />
      </header>

      <div style={styles.tabRow}>
        <button
          type="button"
          style={[styles.tab, mapMode === 'areas' && styles.tabActive]}
          onClick={() => {
            setMapMode('areas');
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          Climbing Areas
        </button>
        <button
          type="button"
          style={[styles.tab, mapMode === 'gyms' && styles.tabActive]}
          onClick={() => {
            setMapMode('gyms');
            setSelectedArea(null);
            setSelectedGym(null);
          }}
        >
          Gyms
        </button>
      </div>

      <div style={styles.globeContainer}>
        <Globe
          ref={globeRef}
          width={typeof window !== 'undefined' ? window.innerWidth : 800}
          height={typeof window !== 'undefined' ? window.innerHeight - 220 : 500}
          backgroundColor="#020c18"
          showGlobe={true}
          showAtmosphere={true}
          atmosphereColor="lightskyblue"
          atmosphereAltitude={0.15}
          globeMaterial={globeMaterial}
          pointsData={pointsData}
          pointLat={(d: PointItem) => d.lat}
          pointLng={(d: PointItem) => d.lng}
          pointColor={(d: PointItem) => (d.hasFriends ? '#00FF41' : '#03A062')}
          pointAltitude={0.01}
          pointRadius={0.4}
          pointsMerge={false}
          onPointClick={(point: PointItem) => {
            if (point.area) setSelectedArea(point.area);
            if (point.gym) setSelectedGym(point.gym);
          }}
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
            <span style={[styles.legendDot, { backgroundColor: '#03A062' }]} />
            <span style={styles.legendText}>
              {mapMode === 'areas' ? 'Climbing area' : 'Gym'}
            </span>
          </div>
          <div style={styles.legendItem}>
            <span style={[styles.legendDot, { backgroundColor: '#00FF41' }]} />
            <span style={styles.legendText}>Friends here</span>
          </div>
        </div>
        <div style={styles.hint}>Drag to rotate · Scroll to zoom · Auto-rotates when idle</div>
      </div>

      {modalVisible && (
        <div
          style={styles.modalOverlay}
          onClick={() => {
            setSelectedArea(null);
            setSelectedGym(null);
          }}
          role="presentation"
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={selectedArea ? 'Area details' : 'Gym details'}
          >
            {selectedArea && (
              <>
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
              </>
            )}
            {selectedGym && (
              <>
                <div style={styles.modalHandle} />
                <div style={styles.modalTitle} title={selectedGym.name}>
                  {selectedGym.name}
                </div>
                <div style={styles.modalLocation}>
                  {selectedGym.address || 'Gym'}
                </div>
                {friendIdsForGym.length > 0 ? (
                  <div style={styles.friendsBadge}>
                    <span style={styles.friendsBadgeText}>
                      {friendIdsForGym.length === 1
                        ? `${friendName(friendIdsForGym[0])} is here`
                        : `${friendIdsForGym.map(friendName).join(', ')} are here`}
                    </span>
                  </div>
                ) : (
                  <div style={styles.noFriends}>No friends at this gym right now</div>
                )}
                <div style={styles.modalActions}>
                  <button
                    type="button"
                    style={styles.viewButton}
                    onClick={() => handleViewGym(selectedGym.id)}
                  >
                    View Gym →
                  </button>
                  <button
                    type="button"
                    style={styles.cancelButton}
                    onClick={() => setSelectedGym(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
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
    borderBottom: '1px solid rgba(3, 160, 98, 0.25)',
    backgroundColor: '#020c18',
    position: 'relative',
    zIndex: 10,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#00FF41',
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
    color: '#00FF41',
    letterSpacing: 3,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    letterSpacing: 1,
  },
  tabRow: {
    display: 'flex',
    flexDirection: 'row',
    padding: '8px 16px',
    gap: 8,
    borderBottom: '1px solid rgba(3, 160, 98, 0.25)',
    backgroundColor: 'transparent',
    position: 'relative',
    zIndex: 10,
  },
  tab: {
    flex: 1,
    padding: '10px 16px',
    textAlign: 'center',
    borderRadius: 8,
    border: '1px solid rgba(3, 160, 98, 0.4)',
    background: 'transparent',
    color: 'rgba(3, 160, 98, 0.9)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(0, 255, 65, 0.12)',
    border: '1px solid #00FF41',
    color: '#00FF41',
  },
  globeContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
    zIndex: 0,
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
