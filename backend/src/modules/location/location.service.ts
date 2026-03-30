import { Injectable } from '@nestjs/common';
import { RoutingService } from '../routing/routing.service';

/**
 * LocationService — thin delegate to RoutingService.
 *
 * All geospatial logic lives in RoutingService / AmazonLocationProvider.
 * This service exists only so LocationModule can inject routing capabilities
 * without duplicating any Amazon SDK client logic.
 */
@Injectable()
export class LocationService {
  constructor(private readonly routing: RoutingService) {}

  isRoutingAvailable(): boolean {
    return this.routing.getAvailability().routes;
  }

  isMapsAvailable(): boolean {
    return this.routing.getAvailability().maps;
  }

  getMapStyleUrl(): string {
    return this.routing.getMapStyleUrl();
  }

  getProviderLabel(): string {
    return this.routing.getProviderLabel();
  }
}
