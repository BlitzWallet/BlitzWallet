import Supercluster from 'supercluster';

export class ClusterManager {
  constructor(options = {}) {
    this._cluster = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
      minPoints: 2,
      ...options,
    });
    this._loaded = false;
  }

  load(points) {
    const features = points.map(p => ({
      type: 'Feature',
      properties: { pointId: p.id, icon: p.icon },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    }));
    this._cluster.load(features);
    this._loaded = true;
  }

  isLoaded() {
    return this._loaded;
  }

  getClusters(bbox, zoom) {
    if (!this._loaded) return [];
    const raw = this._cluster.getClusters(bbox, Math.floor(zoom));
    return raw.map(feature => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      if (props.cluster) {
        return {
          id: `cluster-${props.cluster_id}`,
          type: 'cluster',
          latitude: lat,
          longitude: lon,
          count: props.point_count || 0,
          clusterId: props.cluster_id,
        };
      }
      return {
        id: `point-${props.pointId}`,
        type: 'single',
        latitude: lat,
        longitude: lon,
        count: 1,
        placeId: props.pointId,
      };
    });
  }

  getClusterExpansionZoom(clusterId) {
    if (!this._loaded) return 10;
    try {
      return this._cluster.getClusterExpansionZoom(clusterId);
    } catch {
      return 10;
    }
  }

  getClusterLeaves(clusterId, limit = 100) {
    if (!this._loaded) return [];
    try {
      return this._cluster.getLeaves(clusterId, limit).map(f => ({
        id: f.properties.pointId || 0,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        icon: f.properties.icon || '',
      }));
    } catch {
      return [];
    }
  }
}

export function cameraToBbox(lat, lon, zoom, aspectRatio, padding = 1.0) {
  const safeZoom = Number.isFinite(zoom) ? Math.max(0, Math.min(zoom, 22)) : 13;
  const baseSpan = 360 / Math.pow(2, safeZoom);
  const latSpan = baseSpan * (1 + padding);
  const lonSpan = baseSpan * aspectRatio * (1 + padding);
  return [
    Math.max(-180, lon - lonSpan / 2),
    Math.max(-85, lat - latSpan / 2),
    Math.min(180, lon + lonSpan / 2),
    Math.min(85, lat + latSpan / 2),
  ];
}
