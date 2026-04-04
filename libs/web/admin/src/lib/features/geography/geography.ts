import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import * as L from 'leaflet';

export type GeographyStatus = 'new' | 'verified' | 'in_progress' | 'completed' | 'cancelled';

export interface GeographyFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
}

export interface AssessmentPoint {
  id: string;
  address: string;
  lat: number;
  lng: number;
  status: GeographyStatus;
  statusLabel: string;
  createdAt: string;
}

const DEFAULT_CENTER: L.LatLngExpression = [55.75, 37.62];
const DEFAULT_ZOOM = 5;
const TILE_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});
const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: 'all', label: 'Все статусы' },
  { id: 'new', label: 'Новая' },
  { id: 'verified', label: 'Проверена' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'completed', label: 'Завершена' },
  { id: 'cancelled', label: 'Отменена' },
];

const MOCK_POINTS: AssessmentPoint[] = [
  {
    id: 'a-001',
    address: 'г. Москва, ул. Тверская, д. 1',
    lat: 55.7558,
    lng: 37.6173,
    status: 'in_progress',
    statusLabel: 'В работе',
    createdAt: '2026-03-01',
  },
  {
    id: 'a-002',
    address: 'г. Санкт-Петербург, Невский пр., д. 28',
    lat: 59.9343,
    lng: 30.3351,
    status: 'completed',
    statusLabel: 'Завершена',
    createdAt: '2026-02-28',
  },
  {
    id: 'a-003',
    address: 'г. Казань, ул. Баумана, д. 58',
    lat: 55.7887,
    lng: 49.1221,
    status: 'new',
    statusLabel: 'Новая',
    createdAt: '2026-03-05',
  },
  {
    id: 'a-004',
    address: 'г. Екатеринбург, ул. Ленина, д. 52',
    lat: 56.8389,
    lng: 60.6057,
    status: 'verified',
    statusLabel: 'Проверена',
    createdAt: '2026-03-03',
  },
  {
    id: 'a-005',
    address: 'г. Новосибирск, Красный пр., д. 77',
    lat: 55.0302,
    lng: 82.9204,
    status: 'completed',
    statusLabel: 'Завершена',
    createdAt: '2026-02-20',
  },
];

function setupLeafletIconPath(): void {
  const path = '/leaflet-images/';
  (L.Icon.Default as unknown as { imagePath?: string }).imagePath = path;
}

@Component({
  selector: 'lib-geography',
  standalone: true,
  imports: [LeafletModule],
  templateUrl: './geography.html',
  styleUrl: './geography.scss',
})
export class Geography implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);

  readonly mapOptions: L.MapOptions = {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    layers: [TILE_LAYER],
  };
  readonly center: L.LatLng = L.latLng(DEFAULT_CENTER);
  readonly zoom = DEFAULT_ZOOM;
  readonly statusOptions = STATUS_OPTIONS;

  protected readonly filters = signal<GeographyFilters>({
    status: 'all',
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
  });

  protected readonly layers = signal<L.Layer[]>([]);
  protected readonly mapReady = signal(false);

  private map: L.Map | null = null;

  protected readonly filteredPoints = computed(() => {
    const f = this.filters();
    return MOCK_POINTS.filter((p) => {
      if (f.status !== 'all' && p.status !== f.status) return false;
      const created = p.createdAt;
      if (created < f.dateFrom || created > f.dateTo) return false;
      return true;
    });
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setupLeafletIconPath();
    }
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.mapReady.set(true);
    this.updateMarkers();
  }

  updateMarkers(): void {
    const points = this.filteredPoints();
    const layers: L.Layer[] = [];
    for (const p of points) {
      const marker = L.marker([p.lat, p.lng]);
      const link = `/admin/orders?id=${p.id}`;
      marker.bindPopup(
        `<div class="geography-popup">
          <strong>${p.address}</strong><br>
          <span>Статус: ${p.statusLabel}</span><br>
          <span>Создана: ${p.createdAt}</span><br>
          <a href="${link}">Открыть заявку</a>
        </div>`,
        { className: 'geography-popup-container' },
      );
      layers.push(marker);
    }
    this.layers.set(layers);
  }

  setStatus(value: string): void {
    this.filters.update((f) => ({ ...f, status: value }));
    this.updateMarkers();
  }

  setDateFrom(value: string): void {
    this.filters.update((f) => ({ ...f, dateFrom: value }));
    this.updateMarkers();
  }

  setDateTo(value: string): void {
    this.filters.update((f) => ({ ...f, dateTo: value }));
    this.updateMarkers();
  }

  resetFilters(): void {
    this.filters.set({
      status: 'all',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
    this.updateMarkers();
  }
}
