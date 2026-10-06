# Data Dictionary

This document describes the main data collected, processed and stored by the Adaptive Study Environment Monitor.

## Sensor Data

| Field         | Type    | Source                | Description                                                                   |
| ------------- | ------- | --------------------- | ----------------------------------------------------------------------------- |
| `temperature` | Numeric | DHT11                 | Temperature measured by the study environment monitor                         |
| `humidity`    | Numeric | DHT11                 | Relative humidity measured by the study environment monitor                   |
| `noise`       | Numeric | Analogue sound sensor | Processed measurement representing ambient noise                              |
| `focusScore`  | Numeric | ESP32                 | Rule-based score representing the suitability of the environment for studying |
| `status`      | String  | ESP32                 | Classification of the current study environment                               |
| `room`        | String  | System                | Identifies the study environment/room associated with the reading             |

## Processed Data

The backend processes incoming sensor readings before they are stored.

| Field                  | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `weatherAdjustedFocus` | Focus score adjusted using external weather information    |
| `recommendation`       | Recommendation generated from the environmental conditions |
| `outdoorTemperature`   | External temperature retrieved from the Open-Meteo API     |
| `outdoorHumidity`      | External humidity retrieved from the Open-Meteo API        |

## Focus Score

The project uses a rule-based focus score between 0 and 100.

|  Score | Classification |
| -----: | -------------- |
| 75–100 | GOOD           |
|  50–74 | OK             |
|   0–49 | POOR           |

The score is a project-defined environmental indicator and is not intended to represent a scientifically validated measurement of human concentration.

## Data Processing

The ESP32 collects sensor measurements at regular intervals.

The backend receives these readings and temporarily stores them in memory before calculating aggregated values. The system uses these processed values for historical storage and environmental analysis.

## External Data

The project integrates external weather information using the Open-Meteo API.

This allows local sensor measurements to be compared with external environmental conditions.

## Data Storage

Processed readings are stored using Supabase, which provides PostgreSQL database infrastructure for persistent storage and querying.
