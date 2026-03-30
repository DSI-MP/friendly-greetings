import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoutingService } from '../routing/routing.service';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

@ApiTags('Location')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('location')
export class LocationController {
  constructor(private routing: RoutingService) {}

  @Get('map-config')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR, AppRole.PLANNING)
  getMapConfig() {
    const avail = this.routing.getAvailability();
    const styleUrl = this.routing.getMapStyleUrl();
    const region = this.routing.getRegion();
    const hasApiKey = this.routing.hasApiKey();
    const mapStyle = this.routing.getMapStyle();
    const authMode = this.routing.getAuthMode();
    const styleUrlRegionMatch = styleUrl.match(/maps\.geo\.([a-z0-9-]+)\.amazonaws\.com/);
    const styleUrlRegion = styleUrlRegionMatch?.[1] || null;
    const regionMismatch = !!region && !!styleUrlRegion && region !== styleUrlRegion;

    let configStatus: 'OK' | 'MISSING_KEY' | 'MISSING_REGION' | 'MAPS_DISABLED' | 'INVALID_CONFIG' | 'REGION_MISMATCH' = 'OK';
    let mapEnabled = avail.maps && !!styleUrl;
    let mapErrorCode: string | null = null;
    let mapErrorMessage: string | null = null;

    if (!region) {
      configStatus = 'MISSING_REGION';
      mapEnabled = false;
      mapErrorCode = 'REGION_MISSING';
      mapErrorMessage = 'AWS_REGION environment variable is not set. Cannot generate map style URL.';
    } else if (!hasApiKey) {
      configStatus = 'MISSING_KEY';
      mapEnabled = false;
      mapErrorCode = 'API_KEY_MISSING';
      mapErrorMessage = 'AMAZON_LOCATION_API_KEY environment variable is not set. Maps require an API key.';
    } else if (!avail.maps) {
      configStatus = 'MAPS_DISABLED';
      mapEnabled = false;
      mapErrorCode = 'MAPS_DISABLED';
      mapErrorMessage = 'Amazon Maps are disabled via configuration (AMAZON_LOCATION_ENABLE_MAPS).';
    } else if (!styleUrl) {
      configStatus = 'INVALID_CONFIG';
      mapEnabled = false;
      mapErrorCode = 'STYLE_URL_EMPTY';
      mapErrorMessage = 'Map style URL could not be generated. Check region and map style configuration.';
    } else if (regionMismatch) {
      configStatus = 'REGION_MISMATCH';
      mapEnabled = false;
      mapErrorCode = 'STYLE_URL_REGION_MISMATCH';
      mapErrorMessage = `Map style URL region (${styleUrlRegion}) does not match AWS_REGION (${region}).`;
    }

    return {
      provider: avail.provider,
      region: region || null,
      styleName: mapStyle || null,
      authMode,
      hasApiKey,
      // apiKey intentionally NOT exposed — frontend extracts key from mapStyleUrl
      configStatus,
      mapEnabled,
      mapStyleUrl: styleUrl || null,
      styleUrlType: 'string',
      styleUrlRegion,
      regionMismatch,
      mapErrorCode,
      mapErrorMessage,
      routesAvailable: avail.routes,
      mapsAvailable: avail.maps,
      matrixAvailable: avail.matrix,
      optimizationAvailable: avail.optimization,
      trackingAvailable: avail.tracking,
      geofenceAvailable: avail.geofences,
      degraded: avail.degraded,
      warnings: this.getWarnings(avail),
    };
  }

  @Post('calculate-route')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async calculateRoute(@Body() body: { waypoints: { lat: number; lng: number }[] }) {
    const result = await this.routing.calculateRoute(body.waypoints);
    return result || { error: 'Routing not available', fallback: true };
  }

  @Get('tracker/:vehicleId')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.HR)
  async getVehiclePosition(@Param('vehicleId') vehicleId: string) {
    return {
      trackingAvailable: false,
      reason: 'Trackers require IAM/SigV4 server-side auth — will be enabled in Phase 2.',
    };
  }

  @Post('tracker/:vehicleId')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async updateVehiclePosition(
    @Param('vehicleId') vehicleId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return {
      success: false,
      trackingAvailable: false,
      reason: 'Trackers require IAM/SigV4 server-side auth — will be enabled in Phase 2.',
    };
  }

  @Get('geofences')
  @Roles(AppRole.TRANSPORT_AUTHORITY, AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async listGeofences() {
    return {
      geofenceAvailable: false,
      reason: 'Geofences require IAM/SigV4 server-side auth — will be enabled in Phase 2.',
      items: [],
    };
  }

  private getWarnings(avail: any): string[] {
    const w: string[] = [];
    if (!avail.routes) w.push('Amazon Routes V2 unavailable — routing uses haversine fallback.');
    if (!avail.maps) w.push('Amazon Maps V2 unavailable — map rendering may be limited.');
    if (!avail.tracking) w.push('Trackers disabled — requires IAM/SigV4 auth (Phase 2).');
    if (!avail.geofences) w.push('Geofences disabled — requires IAM/SigV4 auth (Phase 2).');
    if (avail.degraded) w.push('System is in DEGRADED mode — grouping uses haversine fallback instead of road distances.');
    return w;
  }
}
