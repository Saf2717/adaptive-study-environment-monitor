# System Architecture

## Overview

The Adaptive Study Environment Monitor is an IoT system consisting of an ESP32-based sensing device, a Node.js backend, external weather data, a PostgreSQL database hosted through Supabase and notification services.

The system follows an end-to-end data pipeline:

**Sensors → ESP32 → HTTP/JSON → Node.js Backend → Data Processing → External Data Enrichment → Aggregation → PostgreSQL/Supabase → API/Analysis**

## System Components

### 1. ESP32

The ESP32 acts as the edge device responsible for collecting environmental data.

It connects to:

* DHT11 temperature and humidity sensor
* Analogue sound sensor
* SSD1306 OLED display

The ESP32 performs initial processing and calculates the project's environmental focus score before transmitting readings to the backend.

### 2. Sensor Layer

The DHT11 provides:

* Temperature
* Relative humidity

The analogue sound sensor provides a measurement representing the level of ambient noise.

These readings form the primary data source for the system.

### 3. Communication Layer

The ESP32 communicates with the backend using Wi-Fi and HTTP.

Sensor readings are transmitted as JSON data to the Node.js server.

This allows the embedded device and backend to remain separate components.

### 4. Node.js Backend

The backend is implemented using Node.js and Express.

Its responsibilities include:

* Receiving sensor data
* Processing incoming measurements
* Generating environmental recommendations
* Retrieving external weather information
* Adjusting the focus score using weather information
* Temporarily buffering readings
* Calculating aggregated values
* Storing processed data
* Providing REST API endpoints
* Triggering notifications

### 5. External Weather Data

The backend uses the Open-Meteo API to retrieve external weather conditions.

The external data is combined with locally collected sensor data to provide additional environmental context.

This demonstrates data enrichment from multiple sources.

### 6. Aggregation

The ESP32 sends readings at relatively high frequency.

Instead of storing every individual reading directly, the backend temporarily buffers incoming readings and calculates averages before storing the resulting data.

This reduces the number of database writes while maintaining useful information about environmental trends.

### 7. Database

Supabase provides the PostgreSQL database used for persistent storage.

The database allows the system to retain historical environmental measurements that can later be queried for analysis.

### 8. API Layer

The Express backend exposes endpoints for retrieving information such as:

* Latest readings
* Historical readings
* Weather information
* Room information
* Room statistics

These endpoints provide access to the processed dataset.

### 9. Notification Layer

Telegram is used to provide notifications when environmental conditions meet the configured alert criteria.

This demonstrates how processed data can trigger an action rather than simply being stored.

## Data Flow

```text
       ┌──────────────┐
       │    DHT11     │
       │ Temp/Humidity│
       └──────┬───────┘
              │
       ┌──────▼───────┐
       │ Sound Sensor │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │    ESP32     │
       │              │
       │ Collection   │
       │ Processing   │
       │ Focus Score  │
       └──────┬───────┘
              │
           HTTP/JSON
              │
              ▼
       ┌──────────────┐
       │ Node.js /    │
       │ Express      │
       └──────┬───────┘
              │
        ┌─────┴──────────┐
        │                │
        ▼                ▼
 ┌──────────────┐  ┌──────────────┐
 │  Open-Meteo  │  │  Processing  │
 │ Weather API  │  │ Aggregation  │
 └──────────────┘  └──────┬───────┘
                          │
                          ▼
                  ┌──────────────┐
                  │  PostgreSQL  │
                  │   Supabase   │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ REST API /   │
                  │   Analysis   │
                  └──────────────┘
                         │
                         ▼
                    ┌─────────┐
                    │ Telegram│
                    │ Alerts  │
                    └─────────┘
```

## Data Engineering Perspective

The project demonstrates several stages of a basic data engineering pipeline:

1. **Data generation** — physical sensors produce environmental measurements.
2. **Data ingestion** — the ESP32 transmits measurements to the backend.
3. **Data transformation** — raw measurements are processed into useful values.
4. **Data enrichment** — external weather information is added.
5. **Data aggregation** — frequent readings are combined into aggregated values.
6. **Data storage** — processed data is persisted in PostgreSQL.
7. **Data serving** — REST endpoints provide access to the stored data.
8. **Data-driven actions** — processed measurements can trigger notifications.

## Current Limitations

The current implementation is a prototype rather than a production-scale data platform.

The backend uses in-memory buffering for aggregation, meaning buffered measurements could be lost if the server stops before they are persisted.

The system currently focuses on a single study environment rather than a large distributed collection of devices.

The focus score is also a rule-based environmental indicator rather than a scientifically validated measure of concentration.
