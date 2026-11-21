# AtmoSense AI — REST API Documentation (OpenAPI 3.0.3)

## 1. Overview

All AtmoSense AI backend endpoints are served under `/api/*` with:

- **JSON Request/Response Format** (`Content-Type: application/json`)
- **Two-Tier Sliding-Window Rate Limiting**:
  - Data endpoints (`/api/air-quality/*`, `/api/aqi/*`): **100 req/min per IP**
  - AI endpoints (`/api/ai/*`): **30 req/min per IP & per user**
  - Health probe (`/api/health`): **Exempt**
- **Optional Programmatic Authentication**: Supply `X-API-Key: <key>` (verified via constant-time SHA-256 `crypto.timingSafeEqual`) when `ATMOSENSE_API_KEY` is configured.
- **Standard Rate Limit Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` (on HTTP `429`).

---

## 2. Quick `curl` Examples

```bash
# 1. Health probe
curl -s http://localhost:3000/api/health

# 2. Multi-source fused current AQI + persona health recommendation
curl -s "http://localhost:3000/api/aqi/current?lat=28.6139&lng=77.2090&persona=asthmatics"

# 3. Live hyperlocal station + 24h hourly forecast + weather + reverse geocode
curl -s "http://localhost:3000/api/air-quality/by-coords?lat=12.9716&lng=77.5946"

# 4. Automatic IP geolocation fallback
curl -s "http://localhost:3000/api/air-quality/detect-location"

# 5. Personalized daily routine via server-side Gemini AI (with deterministic fallback)
curl -s -X POST http://localhost:3000/api/ai/routine \
  -H "Content-Type: application/json" \
  -d '{
    "persona": "asthmatics",
    "language": "en",
    "zone": { "name": "Connaught Place, Delhi", "aqi": 195, "pm25": 142.5, "pm10": 188.0 }
  }'
```

---

## 3. OpenAPI 3.0.3 Specification

```yaml
openapi: 3.0.3
info:
  title: AtmoSense AI API
  version: 1.0.0
  description: >
    Secure, server-side REST API for multi-source urban air quality telemetry fusion,
    hyperlocal geolocation & reverse geocoding, official US EPA / WHO 2021 calculations,
    and Gemini-powered respiratory protection advisories with deterministic fallback heuristics.
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT
servers:
  - url: http://localhost:3000
    description: Local Development Server
  - url: https://your-production-domain.example.com
    description: Production Server

tags:
  - name: System
    description: Service health and diagnostics
  - name: Air Quality Stations
    description: Curated urban stations, hyperlocal coordinate lookup, and IP geolocation
  - name: Multi-Source AQI
    description: Weighted WAQI + OpenAQ + OpenWeather fusion, forecasting, and provider telemetry
  - name: Pulmonary AI
    description: Server-side Gemini AI endpoints with Zod validation, SHA-256 caching, and heuristic fallback

components:
  securitySchemes:
    ApiKeyHeader:
      type: apiKey
      in: header
      name: X-API-Key
      description: Optional programmatic API key validated in constant time (SHA-256 + timingSafeEqual).
  schemas:
    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: string
          example: Parameter "lat" must be a finite number between -90 and 90.
        retryAfterSeconds:
          type: integer
          example: 42
        details:
          type: object
          additionalProperties: true

    PersonaProfile:
      type: string
      enum: [children, elderly, asthmatics, general]

    ZoneData:
      type: object
      required: [name, aqi, pm25]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 160
        aqi:
          type: number
          minimum: 0
          maximum: 500
        pm25:
          type: number
          minimum: 0
          maximum: 2000
        pm10:
          type: number
          minimum: 0
          maximum: 5000
        no2:
          type: number
          minimum: 0
          maximum: 5000
        o3:
          type: number
          minimum: 0
          maximum: 5
        co:
          type: number
          minimum: 0
          maximum: 500
        so2:
          type: number
          minimum: 0
          maximum: 5000
        dominantPollutant:
          type: string
          maxLength: 32
        temperatureC:
          type: number
          minimum: -60
          maximum: 65
        humidityPct:
          type: number
          minimum: 0
          maximum: 100
        windKph:
          type: number
          minimum: 0
          maximum: 300

    SourceProvenance:
      type: object
      properties:
        source:
          type: string
          enum: [WAQI, OpenAQ, OpenWeather]
        aqi:
          type: number
        pm25:
          type: number
        pm10:
          type: number
        timestamp:
          type: integer
        reliability:
          type: number
        appliedWeight:
          type: number
        isOutlier:
          type: boolean
        deviationPercent:
          type: number

    AirQualityData:
      type: object
      properties:
        aqi:
          type: integer
          minimum: 0
          maximum: 500
        pm25:
          type: number
        pm10:
          type: number
        no2:
          type: number
        co:
          type: number
        o3:
          type: number
        so2:
          type: number
        source:
          type: string
          example: WAQI+OpenWeather
        timestamp:
          type: integer
        location:
          type: object
          properties:
            lat:
              type: number
            lng:
              type: number
            name:
              type: string
        confidence:
          type: number
          minimum: 0
          maximum: 1
        provenance:
          type: array
          items:
            $ref: '#/components/schemas/SourceProvenance'

    ForecastPoint:
      type: object
      properties:
        timestamp:
          type: integer
        date:
          type: string
        aqi:
          type: integer
        category:
          type: string
        color:
          type: string
          example: '#DC2626'
        pm25:
          type: number
        pm10:
          type: number
        no2:
          type: number
        co:
          type: number
        o3:
          type: number
        so2:
          type: number
        source:
          type: string
        confidence:
          type: number

    AirQualityStation:
      type: object
      properties:
        id:
          type: string
        city:
          type: string
        country:
          type: string
        district:
          type: string
        latitude:
          type: number
        longitude:
          type: number
        aqi:
          type: integer
        dominantPollutant:
          type: string
        whoPm25Ratio:
          type: number
        temperatureC:
          type: number
        humidityPct:
          type: number
        windKph:
          type: number
        source:
          type: string
          enum: [live-open-meteo, calibrated-baseline]
        updatedAt:
          type: string
          format: date-time

paths:
  /api/health:
    get:
      tags: [System]
      summary: Server liveness probe
      description: Exempt from rate limiting. Returns service status and sanitized AI configuration flag.
      responses:
        '200':
          description: Server healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: ok
                  service:
                    type: string
                    example: atmosense-ai-server
                  aiConfigured:
                    type: boolean
                  model:
                    type: string
                  timestamp:
                    type: string
                    format: date-time

  /api/air-quality:
    get:
      tags: [Air Quality Stations]
      summary: List all curated global urban stations
      parameters:
        - in: query
          name: refresh
          schema:
            type: string
            enum: ['1']
          description: Bypass 5-minute station cache when set to '1'.
      responses:
        '200':
          description: Array of hydrated urban monitoring stations
          content:
            application/json:
              schema:
                type: object
                properties:
                  count:
                    type: integer
                  stations:
                    type: array
                    items:
                      $ref: '#/components/schemas/AirQualityStation'
                  timestamp:
                    type: string
                    format: date-time

  /api/air-quality/by-coords:
    get:
      tags: [Air Quality Stations]
      summary: Fetch live hyperlocal station telemetry for any coordinates
      parameters:
        - in: query
          name: lat
          required: true
          schema:
            type: number
            minimum: -90
            maximum: 90
        - in: query
          name: lng
          required: true
          schema:
            type: number
            minimum: -180
            maximum: 180
        - in: query
          name: stationId
          schema:
            type: string
            pattern: '^[a-zA-Z0-9_-]{2,64}$'
        - in: query
          name: refresh
          schema:
            type: string
            enum: ['1']
      responses:
        '200':
          description: Live station telemetry with 24h hourly forecast, weather, and reverse-geocoded city/district
          content:
            application/json:
              schema:
                type: object
                properties:
                  station:
                    $ref: '#/components/schemas/AirQualityStation'
                  method:
                    type: string
                    example: coords
                  timestamp:
                    type: string
                    format: date-time
        '400':
          description: Invalid coordinates
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/air-quality/detect-location:
    get:
      tags: [Air Quality Stations]
      summary: Detect user location via server-side IP geolocation fallback
      parameters:
        - in: query
          name: refresh
          schema:
            type: string
            enum: ['1']
      responses:
        '200':
          description: Detected coordinates and hydrated local air quality station
          content:
            application/json:
              schema:
                type: object
                properties:
                  detected:
                    type: boolean
                  method:
                    type: string
                    example: ip
                  station:
                    nullable: true
                    $ref: '#/components/schemas/AirQualityStation'
                  timestamp:
                    type: string
                    format: date-time

  /api/air-quality/{stationId}:
    get:
      tags: [Air Quality Stations]
      summary: Fetch a single monitoring station by ID
      parameters:
        - in: path
          name: stationId
          required: true
          schema:
            type: string
            pattern: '^[a-zA-Z0-9_-]{2,64}$'
        - in: query
          name: refresh
          schema:
            type: string
            enum: ['1']
      responses:
        '200':
          description: Station record
        '400':
          description: Invalid stationId format
        '404':
          description: Station not found

  /api/aqi/current:
    get:
      tags: [Multi-Source AQI]
      summary: Multi-source fused current AQI with provenance and persona advice
      parameters:
        - in: query
          name: lat
          required: true
          schema:
            type: number
            minimum: -90
            maximum: 90
        - in: query
          name: lng
          required: true
          description: Longitude (alias `lon` also accepted)
          schema:
            type: number
            minimum: -180
            maximum: 180
        - in: query
          name: persona
          schema:
            $ref: '#/components/schemas/PersonaProfile'
            default: general
      responses:
        '200':
          description: Fused live AQI reading and EPA/WHO persona summary
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AirQualityData'
                  aqiSummary:
                    type: object
                    properties:
                      aqi:
                        type: integer
                      category:
                        type: string
                      dominantPollutant:
                        type: string
                      color:
                        type: string
                      persona:
                        $ref: '#/components/schemas/PersonaProfile'
                      recommendation:
                        type: string
                  fetchedAt:
                    type: string
                    format: date-time
        '400':
          description: Invalid coordinates or persona
        '429':
          description: Rate limit exceeded
        '503':
          description: All upstream AQI providers unavailable

  /api/aqi/forecast:
    get:
      tags: [Multi-Source AQI]
      summary: Multi-interval AQI forecast (WAQI primary, OpenWeather fallback)
      parameters:
        - in: query
          name: lat
          required: true
          schema:
            type: number
            minimum: -90
            maximum: 90
        - in: query
          name: lng
          required: true
          schema:
            type: number
            minimum: -180
            maximum: 180
      responses:
        '200':
          description: Ordered forecast series
          content:
            application/json:
              schema:
                type: object
                properties:
                  location:
                    type: object
                    properties:
                      lat:
                        type: number
                      lng:
                        type: number
                  count:
                    type: integer
                  forecast:
                    type: array
                    items:
                      $ref: '#/components/schemas/ForecastPoint'
                  generatedAt:
                    type: string
                    format: date-time
        '400':
          description: Invalid coordinates
        '503':
          description: All forecast providers unavailable

  /api/aqi/sources:
    get:
      tags: [Multi-Source AQI]
      summary: Sanitized upstream provider health, rate limits, and LRU cache stats
      responses:
        '200':
          description: Provider statuses and cache metrics

  /api/ai/routine:
    post:
      tags: [Pulmonary AI]
      summary: Generate personalized daily outdoor/indoor routine plan
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [persona, zone]
              properties:
                persona:
                  $ref: '#/components/schemas/PersonaProfile'
                zone:
                  $ref: '#/components/schemas/ZoneData'
                language:
                  type: string
                  default: en
                  minLength: 2
                  maxLength: 24
      responses:
        '200':
          description: Structured RoutinePlan (Gemini or deterministic fallback)
        '400':
          description: Invalid request payload
        '429':
          description: AI rate limit exceeded (30 req/min)

  /api/ai/chat:
    post:
      tags: [Pulmonary AI]
      summary: Conversational pulmonary health and atmospheric science assistant
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [message, context]
              properties:
                message:
                  type: string
                  minLength: 1
                  maxLength: 1200
                context:
                  type: object
                  required: [persona, zone]
                  properties:
                    persona:
                      $ref: '#/components/schemas/PersonaProfile'
                    zone:
                      $ref: '#/components/schemas/ZoneData'
                    language:
                      type: string
                history:
                  type: array
                  maxItems: 20
                  items:
                    type: object
                    required: [role, content]
                    properties:
                      role:
                        type: string
                        enum: [user, assistant]
                      content:
                        type: string
                        maxLength: 1200
                      timestamp:
                        type: number
      responses:
        '200':
          description: Structured ChatResponse with citations and suggested actions
        '400':
          description: Invalid chat payload
        '429':
          description: AI rate limit exceeded

  /api/ai/emergency-advisory:
    post:
      tags: [Pulmonary AI]
      summary: Generate localized emergency air quality bulletin
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [zone, severity]
              properties:
                zone:
                  $ref: '#/components/schemas/ZoneData'
                severity:
                  type: string
                  enum: [moderate, severe, critical]
                language:
                  type: string
                  default: en
      responses:
        '200':
          description: Emergency public health advisory bulletin
        '400':
          description: Invalid advisory payload
        '429':
          description: AI rate limit exceeded

  /api/ai/analyze-image:
    post:
      tags: [Pulmonary AI]
      summary: Multimodal image inspection (smog severity, AQI display OCR, mask fit check)
      description: Accepts up to 6 MB JSON payload with base64-encoded JPEG/PNG/WebP image.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [imageBase64, analysisType]
              properties:
                imageBase64:
                  type: string
                  minLength: 16
                  maxLength: 6500000
                analysisType:
                  type: string
                  enum: [smog-severity, aqi-display, mask-check]
      responses:
        '200':
          description: Structured ImageAnalysisResult with confidence score and recommendations
        '400':
          description: Invalid image payload
        '429':
          description: AI rate limit exceeded

  /api/ai/health-insights:
    post:
      tags: [Pulmonary AI]
      summary: Correlate household symptom logs with historical AQI readings
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [symptomLogs, aqiHistory]
              properties:
                symptomLogs:
                  type: array
                  maxItems: 90
                  items:
                    type: object
                    required: [timestamp, symptoms, severity]
                    properties:
                      timestamp:
                        type: number
                      symptoms:
                        type: array
                        minItems: 1
                        maxItems: 12
                        items:
                          type: string
                      severity:
                        type: integer
                        enum: [1, 2, 3, 4, 5]
                      outdoorMinutes:
                        type: number
                        minimum: 0
                        maximum: 1440
                      notes:
                        type: string
                        maxLength: 400
                aqiHistory:
                  type: array
                  maxItems: 240
                  items:
                    type: object
                    required: [timestamp, aqi]
                    properties:
                      timestamp:
                        type: number
                      aqi:
                        type: number
                        minimum: 0
                        maximum: 500
                      pm25:
                        type: number
                      dominantPollutant:
                        type: string
      responses:
        '200':
          description: Correlated HealthInsight[] array with strength labels and actionable recommendations
        '400':
          description: Invalid insight payload
        '429':
          description: AI rate limit exceeded

  /api/ai/status:
    get:
      tags: [Pulmonary AI]
      summary: Sanitized Gemini AI service status and SHA-256 cache statistics
      responses:
        '200':
          description: AI configuration status (never exposes secrets)
```
