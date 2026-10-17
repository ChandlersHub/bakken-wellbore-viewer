# Bakken Wellbore Viewer

A local interactive 3D viewer for public North Dakota well surveys and production data. The goal is to make the Bakken's well geometry and production history easier to explore visually.

## Features

- Orbit, pan, zoom to a selected well, and switch between plan, side and 3D views.
- North Dakota boundary and city references for geographic orientation.
- Well-section classification, including candidates for sustained sideways deviation in the upper well.
- Azimuth, inclination, DLS, curvature, local tortuosity, signed build/turn rates, TVD, measured depth and horizontal departure.
- Independent color ranges by well section, with custom limits.
- Operator colors, a searchable operator identity, an operator filter, and a fit-to-filter button. Production totals follow the operator filter.
- Monthly oil playback with lateral display width proportional to the square root of monthly barrels.
- Gamma-ray and conventional CBL amplitude overlays on observed vertical survey branches.
- Local canvas recording studios for the cluster showcase and statewide tour.

## Source snapshot and local data

This repository contains application and processing code, the vendored Three.js library with its license, and the geographic reference layer. It does not contain the full survey dataset, production records, LAS files, extracted log catalogs/indexes, caches or videos. Cloning the source alone does not restore the populated viewer.

The current working installation contains 47,802 survey branches and 5,360,341 stations. Those are dataset counts, not files distributed in this repository. Keep the existing local installation and original inputs as the data backup.

## Setup

Install Python dependencies:

```sh
python -m pip install -r requirements.txt
```

To restore the current installation, copy its prepared `full-dataset/` into this directory, its `viewer/data/sample/` and `viewer/data/showcase/` into `viewer/data/`, and its generated log catalogs and survey index into `gamma-data/`. These paths are ignored by Git.

Configure `BAKKEN_LAS_DIR`, `BAKKEN_MANIFEST` and `BAKKEN_SURVEY_DBF` to your original LAS directory, prepared full-dataset manifest and OGD survey DBF. Defaults are `local-data/las`, `full-dataset/manifest.json` and `local-data/OGD_Horizontals.dbf` under this repository. Catalog source paths must also match the local files. This snapshot preserves the working implementation; it is not a one-click portable installer.

Run the full local server once those inputs are configured:

```sh
python serve.py
```

It binds to `127.0.0.1` and prints the viewer URL. Add `--no-browser` to suppress opening a tab, or `--port 65119` to request a particular local port.

For geometry/production only, without the optional log service, serve this folder with Python's static server:

```sh
python -m http.server 65119 --bind 127.0.0.1
```

Then open `http://127.0.0.1:65119/viewer/?dataset=full`. Prepared data is still required; GR/CBL API routes are unavailable on the static server.

## Preparing survey data

The local data was refreshed from the [ND DMR GIS downloads](https://gis.dmr.nd.gov/gisdownload.asp) dated October 17, 2026. The refreshed local survey contains 48,929 branches, 22,498 permit/API10 wells and 5,495,609 retained stations. Download `OGD_Wells.zip` for reported operators and `OGD_Horizontals.zip` for station geometry. Prepared data remains local.

```sh
python prepare_data.py INPUT.dbf full-dataset --tvd-sign positive --source-crs NAD83
python prepare_metrics.py INPUT.dbf full-dataset full-dataset
python prepare_section_scales.py full-dataset full-dataset
```

Choose the TVD sign and CRS to match the input. The first command requires a new output folder. `prepare_production.py --help` describes the production import arguments. Original input files are not modified.

For an existing installation, `prepare_data.py --origin LONGITUDE LATITUDE` preserves its tangent-plane origin when rebuilding geometry. Quote full-precision coordinate strings in PowerShell. Keep all metric, production and log indexes aligned with the new manifest; the local log server must restart after its survey index changes.

Add operator metadata after preparing a survey dataset:

```sh
python prepare_operators.py OGD_Wells.dbf full-dataset --source-date 2026-10-17
```

Choose **Operator** under **Color wellbores by**, then optionally filter a display group and select **Fit displayed operators**. The palette follows the supplied operator legend: Hess/Chevron is green and XTO is amber. Chord/Enerplus/Oasis/Whiting and other combined legend entries are display groups. Selecting a well shows its exact reported DMR operator name. These aliases do not assert legal ownership or reconstruct the operator in a historical production month. Unlisted operators remain individually named with stable colors; unavailable identities are gray. Joins use permit plus API10; mismatches and ambiguous identities are not guessed.

To share an operator-view URL on your local instance, use `/viewer/?dataset=full&color=operator`.

## Operator validation

```sh
python -m unittest discover -s tests -v
node tests/operator-colors.mjs
```

The checks cover strict DBF joins, ambiguous/mismatched identities, palette groups, invalid metadata, per-segment and selected-branch coloring, production ribbon color sharing, operator-filter production totals, and switching datasets without retaining old operator mappings.

## Interpretation

TVD is relative to each well's reference, not a shared elevation datum. Section labels and drillback candidates are geometric classifications. Curvature is DLS expressed in different units. Tortuosity uses a centered, up-to-1,000-ft measured-depth window; planned curves also increase it. Section-specific colors compare variation within a section, not identical values between sections.

Production playback retains the current survey geometry through time. Display widths and log tubes are illustrative, not physical bore diameters. GR/CBL measurements retain their source units; no formation identity, calibration, hydraulic isolation or cement-quality grade is inferred.

## Video routes

- `/viewer/?showcase=cluster`: 35-second cluster showcase.
- `/viewer/?showcase=tour`: 50-second statewide zoom and feature tour.

Both need the prepared showcase subset. The statewide tour additionally needs the full overview and the configured local GR/CBL sources. Recordings are generated and downloaded locally.
