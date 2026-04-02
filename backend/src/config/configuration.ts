export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api',

  database: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/transport_mgmt',
    autoInit: process.env.DB_AUTO_INIT === 'true',
    runMigrations: process.env.DB_RUN_MIGRATIONS === 'true',
    autoCreateTables: process.env.DB_AUTO_CREATE_TABLES === 'true',
    dropAndRecreate: process.env.DB_DROP_AND_RECREATE === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-change-me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
    canRunWithoutApi: process.env.FRONTEND_CAN_RUN_WITHOUT_API === 'true',
  },

  cors: {
    allow: process.env.ALLOW_CORS !== 'false',
    origin: process.env.CORS_ORIGIN || '*',
  },

  swagger: {
    enabled: process.env.NODE_ENV === 'production'
      ? process.env.ENABLE_SWAGGER === 'true'
      : process.env.ENABLE_SWAGGER !== 'false',
  },

  notifications: {
    enabled: process.env.ENABLE_NOTIFICATIONS === 'true',
    sms: process.env.ENABLE_SMS === 'true',
    whatsapp: process.env.ENABLE_WHATSAPP === 'true',
  },

  channels: {
    brevoPasswordResetApiKey: process.env.BREVO_PASSWORD_RESET_API_KEY || '',
    brevoNotificationApiKey: process.env.BREVO_NOTIFICATION_API_KEY || '',
    brevoTransportApiKey: process.env.BREVO_TRANSPORT_API_KEY || '',
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@dsi-transport.com',
    brevoSenderName: process.env.BREVO_SENDER_NAME || 'DSI Transport System',
    smsEnabled: process.env.ENABLE_SMS === 'true',
    smsApiKey: process.env.SMS_API_KEY || '',
    smsProvider: process.env.SMS_PROVIDER || 'brevo',
    whatsappEnabled: process.env.ENABLE_WHATSAPP === 'true',
    whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
  },

  depot: {
    lat: parseFloat(process.env.DEPOT_LAT || '6.0477241'),
    lng: parseFloat(process.env.DEPOT_LNG || '80.2479661'),
  },

  grouping: {
    maxSegmentDurationMinutes: parseInt(process.env.MAX_SEGMENT_DURATION_MINUTES || '90', 10),
    softMaxSegmentDurationMinutes: parseInt(process.env.SOFT_MAX_SEGMENT_DURATION_MINUTES || '75', 10),
    hardMaxSegmentDurationMinutes: parseInt(process.env.HARD_MAX_SEGMENT_DURATION_MINUTES || '120', 10),
    maxStopsPerSegment: parseInt(process.env.MAX_STOPS_PER_SEGMENT || '45', 10),
    largeBucketThreshold: parseInt(process.env.LARGE_BUCKET_THRESHOLD || '50', 10),
    maxRebalanceIterations: parseInt(process.env.MAX_REBALANCE_ITERATIONS || '5', 10),
    maxCorridorSubgroupSize: parseInt(process.env.MAX_CORRIDOR_SUBGROUP_SIZE || '40', 10),
    tollAvoidanceEnabled: process.env.TOLL_AVOIDANCE_ENABLED !== 'false',
    clusterProtectionRadiusKm: parseFloat(process.env.CLUSTER_PROTECTION_RADIUS_KM || '1.5'),
    minCutPointScore: parseFloat(process.env.MIN_CUT_POINT_SCORE || '0.25'),
  },

  vehicle: {
    vanCapacity: parseInt(process.env.VAN_CAPACITY || '15', 10),
    busCapacity: parseInt(process.env.BUS_CAPACITY || '52', 10),
    vanSoftOverflow: parseInt(process.env.VAN_SOFT_OVERFLOW || '4', 10),
    busSoftOverflow: parseInt(process.env.BUS_SOFT_OVERFLOW || '10', 10),
    minVanOccupancy: parseInt(process.env.MIN_VAN_OCCUPANCY || '5', 10),
    minBusOccupancy: parseInt(process.env.MIN_BUS_OCCUPANCY || '15', 10),
  },

  amazonLocation: {
    region: process.env.AWS_REGION || '',
    apiKey: process.env.AMAZON_LOCATION_API_KEY || '',
    authMode: process.env.AMAZON_LOCATION_AUTH_MODE || 'api-key',
    mapStyle: process.env.AMAZON_LOCATION_MAP_STYLE || 'Standard',
    enableMaps: process.env.AMAZON_LOCATION_ENABLE_MAPS !== 'false',
    enableRoutes: process.env.AMAZON_LOCATION_ENABLE_ROUTES !== 'false',
    enableTrackers: process.env.AMAZON_LOCATION_ENABLE_TRACKERS === 'true',
    enableGeofences: process.env.AMAZON_LOCATION_ENABLE_GEOFENCES === 'true',
    trackerName: process.env.AMAZON_LOCATION_TRACKER_NAME || '',
    geofenceCollection: process.env.AMAZON_LOCATION_GEOFENCE_COLLECTION || '',
    timeoutMs: parseInt(process.env.AMAZON_LOCATION_TIMEOUT_MS || '10000', 10),
  },
});
