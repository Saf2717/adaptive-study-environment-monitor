# Adaptive Study Environment Monitor

An IoT-based environmental monitoring system that collects temperature, humidity and ambient noise data and processes these measurements to evaluate study-environment conditions.

The project combines an ESP32-based sensing device with a Node.js backend, external weather data, Supabase PostgreSQL storage and Telegram notifications.

## Overview

The system was designed as an end-to-end data pipeline.

Environmental data is collected from physical sensors connected to an ESP32. The device performs initial processing and transmits the readings to a Node.js/Express backend using HTTP and JSON.

The backend processes the incoming data, retrieves external weather information from Open-Meteo, combines the datasets and aggregates sensor readings before storing the processed information in a Supabase PostgreSQL database.

The stored data can then be retrieved through REST API endpoints for historical analysis and room-level statistics.

## Data Pipeline

```text
Sensors
   ↓
ESP32
   ↓
HTTP / JSON
   ↓
Node.js / Express
   ↓
Data Processing
   ↓
Open-Meteo Weather Enrichment
   ↓
Data Aggregation
   ↓
Supabase / PostgreSQL
   ↓
REST API
   ↓
Analysis / Notifications
```

## Main Features

* Temperature monitoring
* Humidity monitoring
* Ambient noise monitoring
* ESP32-based data collection
* OLED display
* Rule-based focus scoring
* HTTP/JSON data transmission
* Node.js and Express backend
* External weather data integration
* Data aggregation
* PostgreSQL data storage
* Historical data retrieval
* Room statistics
* Telegram notifications

## Hardware

| Component             | Purpose                                  |
| --------------------- | ---------------------------------------- |
| FireBeetle 2 / ESP32  | Main processing and communication device |
| DHT11                 | Temperature and humidity measurement     |
| Analogue sound sensor | Ambient noise measurement                |
| SSD1306 OLED          | Local display                            |

## Software

* C++ / Arduino
* ESP32
* Arduino IoT Cloud
* Node.js
* Express
* JavaScript
* Supabase
* PostgreSQL
* Open-Meteo API
* Telegram Bot API

## Focus Score

The system generates a rule-based environmental focus score from 0 to 100.

|  Score | Status |
| -----: | ------ |
| 75–100 | GOOD   |
|  50–74 | OK     |
|   0–49 | POOR   |

The focus score is a project-defined environmental indicator and should not be interpreted as a scientifically validated measurement of concentration.

## Data Processing

The ESP32 collects sensor measurements at regular intervals.

The backend receives the incoming measurements and temporarily buffers them before calculating aggregated values.

External weather data is retrieved from Open-Meteo and combined with the local sensor readings.

The processed information is then stored in PostgreSQL through Supabase.

This creates a complete pipeline from physical data collection through to persistent storage and analysis.

## Data Engineering Concepts Demonstrated

This project demonstrates:

* Data ingestion
* Data transformation
* Data aggregation
* Data enrichment
* REST API development
* Relational database storage
* Historical data retrieval
* Multi-source data integration
* IoT data collection
* Basic data-quality considerations

More detail is available in [`docs/architecture.md`](docs/architecture.md).

The project data is documented in [`docs/data-dictionary.md`](docs/data-dictionary.md).

## Repository Structure

```text
.
├── arduino/
├── backend/
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

## Configuration

The backend uses environment variables for private configuration.

Create a local `.env` file using `.env.example` as a template.

Required configuration includes Supabase and Telegram credentials.

**Do not commit `.env` to GitHub.**

The ESP32 also requires local Wi-Fi and Arduino IoT Cloud configuration.

## Running the Backend

Install the dependencies:

```bash
cd backend
npm install
```

Start the server:

```bash
npm start
```

The backend runs on port `3000` by default.

## Documentation

* [System Architecture](docs/architecture.md)
* [Data Dictionary](docs/data-dictionary.md)

## Limitations

The current implementation is a prototype.

The backend performs short-term aggregation using application memory rather than a dedicated streaming or message-queue system.

The focus score is rule-based and is not a scientifically validated measure of concentration.

The system was designed around a relatively small-scale IoT deployment rather than a large distributed sensor network.

## Future Development

Possible future improvements include:

* Automated testing
* More robust data validation
* Persistent message buffering
* Support for multiple simultaneous devices
* Improved sensor accuracy
* Automated data-quality monitoring
* Scalable streaming or event-processing infrastructure

## Academic Project

This project demonstrates the integration of embedded systems, data collection, backend development, external API integration, data processing, cloud database storage and analytical functionality.

## Author

**Safwanul Sikder**

BSc Computer Science
University of Kent
