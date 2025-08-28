import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { guidFor } from '@ember/object/internals';
import L from 'leaflet';

export default class PropertyMapComponent extends Component {
  @tracked coordinates = null;
  @tracked isGeocoding = false;
  @tracked geocodeError = null;
  @tracked map = null;
  @tracked marker = null;
  @tracked isManuallyUpdated = false;

  elementId = guidFor(this);

  // Static geocode cache to store results across component instances
  static geocodeCache = new Map();

  constructor() {
    super(...arguments);
    // Check cache first, then geocode if needed
    if (this.args.property?.address) {
      this.loadCoordinates();
    }
  }

  willDestroy() {
    // Clean up Leaflet map when component is destroyed
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    super.willDestroy();
  }

  @action
  loadCoordinates() {
    // Check if property already has lat/lng coordinates
    if (this.args.property?.lat && this.args.property?.lng) {
      console.log('Using existing property coordinates:', {
        lat: this.args.property.lat,
        lng: this.args.property.lng
      });
      
      this.coordinates = {
        lat: this.args.property.lat.toFixed(6),
        lng: this.args.property.lng.toFixed(6)
      };
      
      // Cache these existing coordinates too
      const address = this.getFullAddress();
      PropertyMapComponent.geocodeCache.set(address, this.coordinates);
      
      setTimeout(() => this.initializeMap(), 100);
      return;
    }
    
    // If no existing coordinates, check cache then geocode
    const address = this.getFullAddress();
    const cached = PropertyMapComponent.geocodeCache.get(address);
    
    if (cached) {
      console.log('Using cached coordinates for:', address);
      this.coordinates = cached;
      setTimeout(() => this.initializeMap(), 100);
    } else {
      console.log('No existing or cached coordinates found, geocoding:', address);
      this.geocodeAddress();
    }
  }

  getFullAddress() {
    const property = this.args.property;
    if (!property?.address) return '';
    
    const city = property.city || 'Deerfield';
    const state = property.state || 'NH';
    return `${property.address}, ${city}, ${state}`;
  }

  @action
  async geocodeAddress() {
    if (!this.args.property?.address) {
      this.geocodeError = 'No address provided';
      return;
    }

    this.isGeocoding = true;
    this.geocodeError = null;

    try {
      // For now, we'll use a simple geocoding approach
      // In production, you might want to use Google Maps Geocoding API, Mapbox, or OpenStreetMap
      const address = this.args.property.address;
      const city = this.args.property.city || 'Deerfield';
      const state = this.args.property.state || 'NH';
      const fullAddress = `${address}, ${city}, ${state}`;
      
      console.log('Geocoding address:', fullAddress);

      // Using Nominatim (OpenStreetMap) geocoding service for demo
      const encodedAddress = encodeURIComponent(fullAddress);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`);
      
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        this.coordinates = {
          lat: parseFloat(result.lat).toFixed(6),
          lng: parseFloat(result.lon).toFixed(6)
        };
        console.log('Geocoded coordinates:', this.coordinates);
        
        // Cache the result
        const address = this.getFullAddress();
        PropertyMapComponent.geocodeCache.set(address, this.coordinates);
        console.log('Cached coordinates for:', address);
        
        // Initialize map after coordinates are set and DOM is updated
        setTimeout(() => this.initializeMap(), 100);
      } else {
        throw new Error('No geocoding results found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      this.geocodeError = error.message;
      
      // Fallback to approximate coordinates for Deerfield, NH area
      this.coordinates = {
        lat: (43.1342 + Math.random() * 0.01 - 0.005).toFixed(6),
        lng: (-71.3289 + Math.random() * 0.01 - 0.005).toFixed(6)
      };
      console.log('Using fallback coordinates for Deerfield, NH area:', this.coordinates);
      
      // Cache fallback coordinates too
      const address = this.getFullAddress();
      PropertyMapComponent.geocodeCache.set(address, this.coordinates);
      
      // Initialize map with fallback coordinates
      setTimeout(() => this.initializeMap(), 100);
    } finally {
      this.isGeocoding = false;
    }
  }

  @action
  initializeMap() {
    if (!this.coordinates || this.map) return;

    const mapId = `leaflet-map-${this.elementId}`;
    const mapElement = document.getElementById(mapId);
    
    if (!mapElement) {
      console.error('Map container not found:', mapId);
      return;
    }

    try {
      // Fix Leaflet default marker icon paths (common issue with bundlers)
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create custom hammer icon
      const hammerIcon = L.divIcon({
        className: 'hammer-marker-icon',
        html: `
          <div class="hammer-icon-container">
            <div class="hammer-icon">🔨</div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 25],
        popupAnchor: [0, -25]
      });

      // Initialize map with less aggressive zoom
      this.map = L.map(mapId).setView([
        parseFloat(this.coordinates.lat), 
        parseFloat(this.coordinates.lng)
      ], 16); // Reduced zoom for better context view

      // Define base layers
      const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      });

      // Esri Satellite imagery (free, no API key required)
      const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© <a href="https://www.esri.com/">Esri</a>, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
        maxZoom: 19
      });

      // Hybrid layer (satellite with labels)
      const hybridMap = L.layerGroup([
        satelliteMap,
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          attribution: '© <a href="https://www.esri.com/">Esri</a>',
          maxZoom: 19,
          opacity: 0.8
        })
      ]);

      // Start with satellite view for property viewing
      satelliteMap.addTo(this.map);

      // Create layer control
      const baseLayers = {
        "Satellite": satelliteMap,
        "Hybrid": hybridMap,
        "Street Map": streetMap
      };

      L.control.layers(baseLayers).addTo(this.map);

      // Add marker for property location with hammer icon
      this.marker = L.marker([
        parseFloat(this.coordinates.lat), 
        parseFloat(this.coordinates.lng)
      ], {
        icon: hammerIcon,
        draggable: true
      }).addTo(this.map);

      // Update popup content
      this.updateMarkerPopup();

      // Add click handler to map for updating coordinates
      this.map.on('click', this.onMapClick.bind(this));
      
      // Add drag handler to marker
      this.marker.on('dragend', this.onMarkerDrag.bind(this));

      console.log('Leaflet map with satellite imagery initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Leaflet map:', error);
    }
  }

  @action
  retryGeocode() {
    this.geocodeAddress();
  }

  updateMarkerPopup() {
    if (!this.marker) return;
    
    const address = this.args.property?.address || 'Property Location';
    const owner = this.args.property?.owner || 'Unknown Owner';
    const statusText = this.isManuallyUpdated ? 'Manually adjusted' : 'From property data';
    
    this.marker.bindPopup(`
      <div class="property-popup">
        <strong>${address}</strong><br>
        Owner: ${owner}<br>
        <small>Lat: ${this.coordinates.lat}, Lng: ${this.coordinates.lng}</small><br>
        <em style="color: var(--text-muted); font-size: 0.75rem;">${statusText}</em>
      </div>
    `);
    
    // Don't auto-open popup by default
    // Users can click the marker to see details if needed
  }

  updateCoordinates(lat, lng) {
    this.coordinates = {
      lat: lat.toFixed(6),
      lng: lng.toFixed(6)
    };
    
    // Update cache with new coordinates
    const address = this.getFullAddress();
    PropertyMapComponent.geocodeCache.set(address, this.coordinates);
    
    this.isManuallyUpdated = true;
    this.updateMarkerPopup();
    
    console.log('Coordinates updated manually:', this.coordinates);
  }

  onMapClick(e) {
    const { lat, lng } = e.latlng;
    
    // Move marker to clicked location
    this.marker.setLatLng([lat, lng]);
    
    // Update coordinates
    this.updateCoordinates(lat, lng);
    
    // Show popup at new location
    this.marker.openPopup();
  }

  onMarkerDrag(e) {
    const { lat, lng } = e.target.getLatLng();
    
    // Update coordinates
    this.updateCoordinates(lat, lng);
  }
}